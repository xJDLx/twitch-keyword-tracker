'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectRole, messageMatchesKeyword } = require('../src/chatTracker');

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
