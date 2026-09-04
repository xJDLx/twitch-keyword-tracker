'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app } = require('../src/server');

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (err) {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('POST /api/track rejects missing keyword', async (t) => {
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());

  const res = await request(server, 'POST', '/api/track', {
    channelUrl: 'https://www.twitch.tv/somechannel',
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /keyword/i);
});

test('POST /api/track rejects invalid channel URL', async (t) => {
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());

  const res = await request(server, 'POST', '/api/track', {
    channelUrl: 'https://www.youtube.com/somechannel',
    keyword: 'pizza',
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /twitch\.tv/i);
});

test('POST /api/track/:sessionId/stop returns 404 for unknown session', async (t) => {
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());

  const res = await request(server, 'POST', '/api/track/unknown-session/stop');

  assert.equal(res.status, 404);
});

test('GET /api/track/:sessionId/matches returns empty list for unknown session', async (t) => {
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());

  const res = await request(server, 'GET', '/api/track/unknown-session/matches');

  assert.equal(res.status, 200);
  assert.equal(res.body.tracking, false);
  assert.deepEqual(res.body.matches, []);
});
