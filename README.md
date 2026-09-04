# twitch-keyword-tracker
Web app that tracks Twitch chat keyword matches by channel URL and displays usernames and roles.

## What it does

Paste a public Twitch channel URL (e.g. `https://www.twitch.tv/somechannel`) and a
keyword (e.g. `pizza`) into the web page, click **Start tracking**, and the app
will:

1. Parse the channel name out of the URL.
2. Connect anonymously (read-only, no Twitch login required) to that channel's
   public chat.
3. Watch incoming messages for your keyword (case-insensitive substring match).
4. Record each match: username, channel, best-effort role, the matched
   message, and a timestamp.
5. Display the growing list of matches live in a table on the page.

## Stack

- **Backend:** Node.js + Express
- **Chat listener:** [`tmi.js`](https://tmijs.com/), connected anonymously
  (no Twitch OAuth/login is required to read public chat)
- **Persistence:** SQLite (via `better-sqlite3`), stored in `data/tracker.db`
- **Frontend:** static HTML/CSS/JavaScript served by the Express app, polling
  the API every couple of seconds for new matches

## Requirements

- Node.js 18+ (Node.js 22 is used in development; the built-in `node --test`
  test runner is used for the test suite)

## Setup

```bash
npm install
```

## Running locally

```bash
npm start
```

Then open <http://localhost:3000> in your browser. Set the `PORT` environment
variable to run on a different port.

## Running tests

```bash
npm test
```

## How it works

- `POST /api/track` accepts `{ channelUrl, keyword }`, validates both, starts
  an anonymous chat connection for that channel, and returns a `sessionId`.
- `GET /api/track/:sessionId/matches` returns the matches collected so far for
  that session (the frontend polls this endpoint).
- `POST /api/track/:sessionId/stop` disconnects the chat client for that
  session.

## Limitations

- **No login required, by design.** Because the app never asks the channel
  owner or the tracker's user to authenticate with Twitch, it can only read
  what's publicly visible in chat via an anonymous IRC connection
  (`tmi.js` connects as a `justinfan###` guest).
- **Subscriber detection is best-effort.** Twitch chat tags/badges usually
  expose `broadcaster`, `moderator`, and `vip` reliably. Subscriber badges are
  also present in public chat tags most of the time, but Twitch does not
  guarantee this is always accurate or complete without an authenticated API
  call. Treat the `sub` role in results as a best-effort signal, not a
  guarantee.
- **Single process, in-memory session tracking.** Chat connections are held
  in memory per running server process; restarting the server stops all
  active tracking sessions (previously collected matches remain in the SQLite
  database).

