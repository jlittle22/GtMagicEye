const TOKEN_STORAGE_KEY = 'gt_auth_token';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

export function generateSessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `sess-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// Polls the server for a token stashed under sessionId by the login page.
// Cross-tab handoff can't rely on window.opener/postMessage here since
// browsers isolate popups from cross-origin openers by default (COOP), which
// silently nulls window.opener even for a real user-clicked target="_blank"
// link — this sidesteps that entirely via the server as an intermediary.
export async function pollForToken(apiBase, sessionId, { intervalMs = 1500, timeoutMs = 5 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${apiBase}/api/auth/session/${encodeURIComponent(sessionId)}`);
    if (res.ok) {
      const { token } = await res.json();
      return token;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('login timed out');
}
