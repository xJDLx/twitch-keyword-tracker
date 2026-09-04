'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { detectRole, messageMatchesKeyword, ChatTrackerManager } = require('../src/chatTracker');

function createFakeClient() {
  const emitter = new EventEmitter();
  emitter.connect = async () => {};
  emitter.disconnect = async () => {};
  return emitter;
}

test('detectRole identifies broadcaster', () => {
  assert.equal(detectRole({ badges: { broadcaster: '1' } }), 'broadcaster');
});

test('detectRole identifies mod via badges', () => {
  assert.equal(detectRole({ badges: { moderator: '1' } }), 'mod');
});

test('detectRole identifies mod via tags.mod', () => {
  assert.equal(detectRole({ mod: true, badges: {} }), 'mod');
});

test('detectRole identifies vip', () => {
  assert.equal(detectRole({ badges: { vip: '1' } }), 'vip');
});

test('detectRole identifies sub via badges', () => {
  assert.equal(detectRole({ badges: { subscriber: '1' } }), 'sub');
});

test('detectRole identifies sub via tags.subscriber', () => {
  assert.equal(detectRole({ subscriber: true, badges: {} }), 'sub');
});

test('detectRole defaults to viewer', () => {
  assert.equal(detectRole({ badges: {} }), 'viewer');
  assert.equal(detectRole({}), 'viewer');
});

test('detectRole prioritizes broadcaster over other roles', () => {
  assert.equal(
    detectRole({ mod: true, subscriber: true, badges: { broadcaster: '1', moderator: '1' } }),
    'broadcaster'
  );
});

test('messageMatchesKeyword matches case-insensitively', () => {
  assert.equal(messageMatchesKeyword('I love PIZZA', 'pizza'), true);
});

test('messageMatchesKeyword matches keyword as substring', () => {
  assert.equal(messageMatchesKeyword('pizzas are great', 'pizza'), true);
});

test('messageMatchesKeyword returns false when not present', () => {
  assert.equal(messageMatchesKeyword('I love tacos', 'pizza'), false);
});

test('messageMatchesKeyword handles missing message or keyword', () => {
  assert.equal(messageMatchesKeyword('', 'pizza'), false);
  assert.equal(messageMatchesKeyword('pizza', ''), false);
  assert.equal(messageMatchesKeyword(null, 'pizza'), false);
});

test('ChatTrackerManager emits a match for keyword hits and records role', async () => {
  const clients = [];
  const manager = new ChatTrackerManager({
    createClient: () => {
      const client = createFakeClient();
      clients.push(client);
      return client;
    },
  });

  const matches = [];
  manager.on('match', (match) => matches.push(match));

  await manager.start('session-1', 'somechannel', 'pizza');
  assert.equal(manager.isTracking('session-1'), true);

  clients[0].emit('message', '#somechannel', { username: 'alice', mod: true, badges: {} }, 'I love pizza', false);
  clients[0].emit('message', '#somechannel', { username: 'bob', badges: {} }, 'no match here', false);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].username, 'alice');
  assert.equal(matches[0].role, 'mod');
  assert.equal(matches[0].channel, 'somechannel');

  await manager.stop('session-1');
  assert.equal(manager.isTracking('session-1'), false);
});

test('ChatTrackerManager rejects starting a duplicate session', async () => {
  const manager = new ChatTrackerManager({ createClient: () => createFakeClient() });
  await manager.start('dup-session', 'somechannel', 'pizza');
  await assert.rejects(() => manager.start('dup-session', 'somechannel', 'pizza'), /already tracking/i);
  await manager.stop('dup-session');
});

test('ChatTrackerManager rejects stopping an unknown session', async () => {
  const manager = new ChatTrackerManager({ createClient: () => createFakeClient() });
  await assert.rejects(() => manager.stop('nope'), /not found/i);
});

test('ChatTrackerManager enforces a max number of concurrent sessions', async () => {
  const manager = new ChatTrackerManager({ createClient: () => createFakeClient() });
  const sessionIds = [];

  for (let i = 0; i < 20; i++) {
    const id = `session-${i}`;
    sessionIds.push(id);
    await manager.start(id, 'somechannel', 'pizza');
  }

  await assert.rejects(
    () => manager.start('one-too-many', 'somechannel', 'pizza'),
    /too many active tracking sessions/i
  );

  for (const id of sessionIds) {
    await manager.stop(id);
  }
});

test('ChatTrackerManager surfaces connection errors', async () => {
  const manager = new ChatTrackerManager({
    createClient: () => {
      const client = createFakeClient();
      client.connect = async () => {
        throw new Error('boom');
      };
      return client;
    },
  });

  await assert.rejects(
    () => manager.start('fails', 'somechannel', 'pizza'),
    /failed to connect to twitch chat: boom/i
  );
  assert.equal(manager.isTracking('fails'), false);
});

test('ChatTrackerManager auto-expires a session after maxSessionDurationMs', async () => {
  const manager = new ChatTrackerManager({
    createClient: () => createFakeClient(),
    maxSessionDurationMs: 20,
  });

  await manager.start('expiring', 'somechannel', 'pizza');
  assert.equal(manager.isTracking('expiring'), true);

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(manager.isTracking('expiring'), false);
});
