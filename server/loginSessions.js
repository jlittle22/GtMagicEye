// In-memory, single-instance store bridging the login page (which has the
// token) and the polling Grepolis tab (which doesn't share an origin with
// it, so postMessage/localStorage can't cross that gap reliably — see COOP).
const sessions = new Map(); // sessionId -> { token, expiresAt }
const TTL_MS = 5 * 60 * 1000;

export function storeSessionToken(sessionId, token) {
  sessions.set(sessionId, { token, expiresAt: Date.now() + TTL_MS });
}

// Single-use: deletes the entry once a token is actually handed back, so a
// guessed/leaked sessionId can't be replayed after the real client consumes it.
export function consumeSessionToken(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return null;

  sessions.delete(sessionId);
  if (Date.now() > entry.expiresAt) return null;
  return entry.token;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now > entry.expiresAt) sessions.delete(id);
  }
}, 60 * 1000).unref();
