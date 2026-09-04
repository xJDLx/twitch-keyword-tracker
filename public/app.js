'use strict';

const form = document.getElementById('track-form');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const resultsBody = document.getElementById('results-body');
const channelUrlInput = document.getElementById('channelUrl');
const keywordInput = document.getElementById('keyword');

let sessionId = null;
let pollTimer = null;

function setError(message) {
  errorEl.textContent = message || '';
}

function setStatus(message) {
  statusEl.textContent = message || '';
}

function renderMatches(matches) {
  resultsBody.innerHTML = '';
  for (const match of matches) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(match.username)}</td>
      <td>${escapeHtml(match.channel)}</td>
      <td>${escapeHtml(match.role)}</td>
      <td>${escapeHtml(match.message)}</td>
      <td>${new Date(match.timestamp).toLocaleTimeString()}</td>
    `;
    resultsBody.appendChild(row);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function pollMatches() {
  if (!sessionId) return;
  try {
    const res = await fetch(`/api/track/${sessionId}/matches`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to fetch matches.');
      return;
    }
    renderMatches(data.matches);
  } catch (err) {
    setError('Network error while fetching matches.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');
  setStatus('Connecting to Twitch chat...');
  startBtn.disabled = true;

  try {
    const res = await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelUrl: channelUrlInput.value,
        keyword: keywordInput.value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to start tracking.');
      setStatus('');
      startBtn.disabled = false;
      return;
    }

    sessionId = data.sessionId;
    setStatus(`Tracking "${data.keyword}" in #${data.channel}...`);
    stopBtn.disabled = false;
    resultsBody.innerHTML = '';

    pollTimer = setInterval(pollMatches, 2000);
    pollMatches();
  } catch (err) {
    setError('Network error while starting tracking.');
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', async () => {
  if (!sessionId) return;
  stopBtn.disabled = true;

  try {
    await fetch(`/api/track/${sessionId}/stop`, { method: 'POST' });
  } catch (err) {
    // Ignore network errors on stop; we still reset local state.
  }

  clearInterval(pollTimer);
  pollTimer = null;
  setStatus('Tracking stopped.');
  startBtn.disabled = false;
  sessionId = null;
});
