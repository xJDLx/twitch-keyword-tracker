'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChannelFromUrl } = require('../src/twitchUrl');

test('parses a standard twitch.tv URL', () => {
  assert.equal(parseChannelFromUrl('https://www.twitch.tv/somechannel'), 'somechannel');
});

test('parses a URL without www', () => {
  assert.equal(parseChannelFromUrl('https://twitch.tv/SomeChannel'), 'somechannel');
});

test('parses a URL without protocol', () => {
  assert.equal(parseChannelFromUrl('twitch.tv/somechannel'), 'somechannel');
});

test('parses a bare channel name', () => {
  assert.equal(parseChannelFromUrl('somechannel'), 'somechannel');
});

test('parses a URL with trailing path segments', () => {
  assert.equal(parseChannelFromUrl('https://www.twitch.tv/somechannel/videos'), 'somechannel');
});

test('rejects empty input', () => {
  assert.throws(() => parseChannelFromUrl(''), /required/i);
});

test('rejects non-twitch URLs', () => {
  assert.throws(() => parseChannelFromUrl('https://www.youtube.com/somechannel'), /twitch\.tv/i);
});

test('rejects channel names that are too short', () => {
  assert.throws(() => parseChannelFromUrl('ab'), /invalid channel name/i);
});

test('rejects channel names with invalid characters', () => {
  assert.throws(() => parseChannelFromUrl('some channel!'), /invalid/i);
});

test('rejects a twitch.tv URL with no channel path', () => {
  assert.throws(() => parseChannelFromUrl('https://www.twitch.tv/'), /channel name/i);
});
