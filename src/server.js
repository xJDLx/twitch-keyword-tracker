'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { parseChannelFromUrl } = require('./twitchUrl');
const { ChatTrackerManager } = require('./chatTracker');
const { saveMatch, getMatchesForSession } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const tracker = new ChatTrackerManager();

tracker.on('match', (match) => {
  saveMatch(match);
});

// POST /api/track { channelUrl, keyword } -> starts a tracking session
app.post('/api/track', async (req, res) => {
  const { channelUrl, keyword } = req.body || {};

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
    return res.status(400).json({ error: 'Keyword is required.' });
  }

  let channel;
  try {
    channel = parseChannelFromUrl(channelUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const sessionId = crypto.randomUUID();
  const trimmedKeyword = keyword.trim();

  try {
    await tracker.start(sessionId, channel, trimmedKeyword);
  } catch (err) {
    const status = /too many active tracking sessions/i.test(err.message) ? 429 : 502;
    return res.status(status).json({ error: err.message });
  }

  return res.status(201).json({ sessionId, channel, keyword: trimmedKeyword });
});

// POST /api/track/:sessionId/stop -> stops a tracking session
app.post('/api/track/:sessionId/stop', async (req, res) => {
  const { sessionId } = req.params;

  try {
    await tracker.stop(sessionId);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  return res.json({ stopped: true });
});

// GET /api/track/:sessionId/matches -> returns matches collected so far
app.get('/api/track/:sessionId/matches', (req, res) => {
  const { sessionId } = req.params;
  const matches = getMatchesForSession(sessionId);
  return res.json({
    sessionId,
    tracking: tracker.isTracking(sessionId),
    matches,
  });
});

// Fallback error handler for unexpected errors.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Twitch keyword tracker listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, tracker };
