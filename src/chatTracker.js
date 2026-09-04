'use strict';

const { EventEmitter } = require('events');
const tmi = require('tmi.js');

/**
 * Best-effort role detection from Twitch chat tags (userstate).
 * Without authenticated API access we cannot reliably confirm subscriber
 * status in every case, so "sub" is best-effort based on chat badges/tags.
 *
 * @param {object} tags tmi.js userstate/tags object
 * @returns {'broadcaster'|'mod'|'vip'|'sub'|'viewer'}
 */
function detectRole(tags = {}) {
  const badges = tags.badges || {};

  if (Object.prototype.hasOwnProperty.call(badges, 'broadcaster')) {
    return 'broadcaster';
  }
  if (tags.mod || Object.prototype.hasOwnProperty.call(badges, 'moderator')) {
    return 'mod';
  }
  if (Object.prototype.hasOwnProperty.call(badges, 'vip')) {
    return 'vip';
  }
  if (tags.subscriber || Object.prototype.hasOwnProperty.call(badges, 'subscriber')) {
    return 'sub';
  }
  return 'viewer';
}

/**
 * Checks whether a chat message contains the given keyword.
 * Matching is case-insensitive and matches on whole/partial word occurrence.
 *
 * @param {string} message
 * @param {string} keyword
 * @returns {boolean}
 */
function messageMatchesKeyword(message, keyword) {
  if (!message || !keyword) return false;
  return message.toLowerCase().includes(keyword.toLowerCase());
}

const MAX_CONCURRENT_SESSIONS = 20;
const SESSION_MAX_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Manages Twitch chat tracking sessions. Each session connects anonymously
 * (read-only, no login required) to a single channel and watches for a
 * keyword, emitting a 'match' event with match details whenever found.
 */
class ChatTrackerManager extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {(channel: string) => tmi.Client} [options.createClient] Factory
   *   for the underlying chat client, primarily for testing.
   * @param {number} [options.maxSessionDurationMs] Auto-expiry duration for
   *   a session, primarily for testing.
   */
  constructor(options = {}) {
    super();
    this.sessions = new Map();
    this.maxSessionDurationMs = options.maxSessionDurationMs || SESSION_MAX_DURATION_MS;
    this.createClient =
      options.createClient ||
      ((channel) =>
        new tmi.Client({
          options: { skipMembership: true },
          connection: { reconnect: true, secure: true },
          channels: [channel],
        }));
  }

  /**
   * Starts tracking a channel for a keyword.
   * @param {string} sessionId
   * @param {string} channel normalized channel name
   * @param {string} keyword
   * @returns {Promise<void>}
   */
  async start(sessionId, channel, keyword) {
    if (this.sessions.has(sessionId)) {
      throw new Error('Session is already tracking.');
    }

    if (this.sessions.size >= MAX_CONCURRENT_SESSIONS) {
      throw new Error('Too many active tracking sessions. Please try again later.');
    }

    const client = this.createClient(channel);

    const onMessage = (chan, tags, message, self) => {
      if (self) return;
      if (!messageMatchesKeyword(message, keyword)) return;

      const match = {
        sessionId,
        channel,
        keyword,
        username: tags['display-name'] || tags.username || 'unknown',
        role: detectRole(tags),
        message,
        timestamp: new Date().toISOString(),
      };

      this.emit('match', match);
    };

    client.on('message', onMessage);

    let connectError = null;
    try {
      await client.connect();
    } catch (err) {
      connectError = err;
    }

    if (connectError) {
      client.removeListener('message', onMessage);
      throw new Error(`Failed to connect to Twitch chat: ${connectError.message || connectError}`);
    }

    // Auto-expire long-running sessions so an abandoned tracker (client
    // started tracking but never stopped) doesn't hold a chat connection
    // open forever.
    const expiryTimer = setTimeout(() => {
      this.stop(sessionId).catch(() => {});
    }, this.maxSessionDurationMs);
    expiryTimer.unref();

    this.sessions.set(sessionId, { client, channel, keyword, expiryTimer });
  }

  /**
   * Stops tracking for a session, disconnecting the chat client.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async stop(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }
    this.sessions.delete(sessionId);
    clearTimeout(session.expiryTimer);
    try {
      await session.client.disconnect();
    } catch (err) {
      // Ignore disconnect errors, the session is already removed.
    }
  }

  isTracking(sessionId) {
    return this.sessions.has(sessionId);
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return { channel: session.channel, keyword: session.keyword };
  }
}

module.exports = { ChatTrackerManager, detectRole, messageMatchesKeyword };
