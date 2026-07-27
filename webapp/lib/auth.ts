const TOKEN_STORAGE_KEY = "gt_webapp_auth_token";

// Mirrors ReportSubmitterDocument on the server (server/database/reportDocument.js)
// — that's the exact shape jwt.sign() is given, so it's what comes back out.
// Date fields arrive as ISO strings here, not Date instances: they only
// existed as real Dates on the server side before being JSON-serialized into
// the token payload.
export interface AuthUser {
  _id: string;
  username: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser | null;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

// Decodes the JWT payload for display (username, etc.) only — not signature
// verification. The server is the one that actually verifies + re-checks ban
// status on every request (see requireAuth); this is just so the header can
// show who's logged in without a round trip.
export function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const [, payload] = token.split(".");
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    // atob gives a Latin1 "binary string" — one char per byte, not per UTF-8
    // code point, so a username with e.g. accented characters would come out
    // as mojibake without decoding the raw bytes through TextDecoder first.
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// Same endpoint the userscript's login page posts to (server/public/login.html
// -> POST /api/auth/login) and the same JWT it gets back. The userscript needs
// a popup + session-id relay dance because it runs on grepolis.com, a
// different origin from the API; this page IS that origin, so a plain
// same-origin POST is all that's needed here.
export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || "Login failed");
  }

  setStoredToken(body.token);
  return { token: body.token, user: decodeJwtPayload(body.token) };
}
