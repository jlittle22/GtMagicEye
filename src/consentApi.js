import { setStoredToken } from "./auth.js";

// __API_BASE__ is injected at build time from config.cjs (see build.cjs).
const API_BASE = __API_BASE__;

async function callConsentEndpoint(method, token) {
  try {
    const res = await fetch(`${API_BASE}/api/consent`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    setStoredToken(data.token);
    return data.token;
  } catch {
    return null;
  }
}

// Both endpoints carry no game data — just the Authorization header — so
// either is always safe to call regardless of where consent currently
// stands. Used by the settings panel's consent checkbox
// (src/ui/settingsMenu.js). The main indexing flow's own consent gate
// (src/index.js) has its own grant path with an extra fallback for tokens
// minted before consentedAt existed on the JWT.
export const grantConsent = (token) => callConsentEndpoint("POST", token);
export const revokeConsent = (token) => callConsentEndpoint("DELETE", token);

const DECLINED_KEY = "gt_consent_declined";

// sessionStorage (not localStorage) is deliberate: it scopes this to one
// browser tab's lifetime, so declining means "not this session" rather than
// "not ever" — closing the tab (a new session) clears it and the consent
// prompt is asked again next time. Read by authenticatedFetch (src/index.js)
// to skip every game-data request outright while set, and by the toolbar
// warning indicator to show the same "!" marker used for "not logged in".
export function hasDeclinedConsentThisSession() {
  try {
    return sessionStorage.getItem(DECLINED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setDeclinedConsentThisSession(declined) {
  try {
    if (declined) sessionStorage.setItem(DECLINED_KEY, "true");
    else sessionStorage.removeItem(DECLINED_KEY);
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}
