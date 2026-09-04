'use strict';

// Twitch usernames/channel names are 4-25 chars, letters/numbers/underscore.
const CHANNEL_NAME_PATTERN = /^[a-zA-Z0-9_]{4,25}$/;

/**
 * Parses a Twitch channel URL (or bare channel name) into a normalized
 * lowercase channel name.
 *
 * Accepts inputs like:
 *   - https://www.twitch.tv/somechannel
 *   - http://twitch.tv/somechannel
 *   - twitch.tv/somechannel
 *   - somechannel
 *
 * @param {string} input
 * @returns {string} normalized channel name (lowercase)
 * @throws {Error} if the input cannot be parsed into a valid channel name
 */
function parseChannelFromUrl(input) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('Twitch channel URL is required.');
  }

  let value = input.trim();

  const looksLikeUrl = /^https?:\/\//i.test(value) || value.includes('twitch.tv');
  if (looksLikeUrl && !/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let channel;
  if (looksLikeUrl) {
    let url;
    try {
      url = new URL(value);
    } catch (err) {
      throw new Error('Invalid Twitch channel URL.');
    }
    if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) {
      throw new Error('URL must be a twitch.tv link.');
    }
    const segments = url.pathname.split('/').filter(Boolean);
    channel = segments[0];
  } else {
    // Treat as a bare channel name.
    channel = value;
  }

  if (!channel) {
    throw new Error('Could not find a channel name in that URL.');
  }

  channel = channel.toLowerCase();

  if (!CHANNEL_NAME_PATTERN.test(channel)) {
    throw new Error(
      'Invalid channel name. Twitch channel names are 4-25 characters (letters, numbers, underscore).'
    );
  }

  return channel;
}

module.exports = { parseChannelFromUrl, CHANNEL_NAME_PATTERN };
