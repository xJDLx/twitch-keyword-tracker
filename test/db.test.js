'use strict';

// Note: this test relies on DB_PATH=:memory: being set (see the "test"
// script in package.json) so it doesn't touch the real data/tracker.db file.
const test = require('node:test');
const assert = require('node:assert/strict');
const { saveMatch, getMatchesForSession } = require('../src/db');

test('saveMatch persists a match and getMatchesForSession retrieves it', () => {
  const sessionId = `test-session-${Date.now()}`;
  const match = {
    sessionId,
    channel: 'somechannel',
    keyword: 'pizza',
    username: 'alice',
    role: 'viewer',
    message: 'I love pizza',
    timestamp: new Date().toISOString(),
  };

  const saved = saveMatch(match);
  assert.ok(saved.id);

  const rows = getMatchesForSession(sessionId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].username, 'alice');
  assert.equal(rows[0].channel, 'somechannel');
  assert.equal(rows[0].role, 'viewer');
  assert.equal(rows[0].message, 'I love pizza');
});

test('getMatchesForSession preserves insertion order and only matches the given session', () => {
  const sessionA = `session-a-${Date.now()}`;
  const sessionB = `session-b-${Date.now()}`;

  saveMatch({
    sessionId: sessionA,
    channel: 'c',
    keyword: 'pizza',
    username: 'first',
    role: 'viewer',
    message: 'pizza one',
    timestamp: new Date().toISOString(),
  });
  saveMatch({
    sessionId: sessionB,
    channel: 'c',
    keyword: 'pizza',
    username: 'other-session',
    role: 'viewer',
    message: 'pizza',
    timestamp: new Date().toISOString(),
  });
  saveMatch({
    sessionId: sessionA,
    channel: 'c',
    keyword: 'pizza',
    username: 'second',
    role: 'mod',
    message: 'pizza two',
    timestamp: new Date().toISOString(),
  });

  const rows = getMatchesForSession(sessionA);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.username), ['first', 'second']);
});

test('getMatchesForSession returns an empty array for an unknown session', () => {
  assert.deepEqual(getMatchesForSession('does-not-exist'), []);
});
