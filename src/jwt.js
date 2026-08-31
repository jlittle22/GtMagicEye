// Decodes (without verifying) the payload segment of a JWT — safe here
// since this only ever reads a token this client already received from our
// own server; the server re-verifies the signature and re-checks account
// state on every request regardless of what a decoded claim says.
export function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
