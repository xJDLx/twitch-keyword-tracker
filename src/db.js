'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'tracker.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    keyword TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
`);

const insertStmt = db.prepare(`
  INSERT INTO matches (session_id, channel, keyword, username, role, message, timestamp)
  VALUES (@sessionId, @channel, @keyword, @username, @role, @message, @timestamp)
`);

const selectBySessionStmt = db.prepare(`
  SELECT id, session_id AS sessionId, channel, keyword, username, role, message, timestamp
  FROM matches
  WHERE session_id = ?
  ORDER BY id ASC
`);

function saveMatch(match) {
  const info = insertStmt.run(match);
  return { id: info.lastInsertRowid, ...match };
}

function getMatchesForSession(sessionId) {
  return selectBySessionStmt.all(sessionId);
}

module.exports = { db, saveMatch, getMatchesForSession };
