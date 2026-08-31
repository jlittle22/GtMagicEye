import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { ReportSubmitterDocument } from '../database/reportDocument.js';
import { getDb } from '../db.js';

// Shared by requireAuth and requireAuthIgnoreConsent: verifies the token and
// looks up the account's current bannedSince/consentedAt from the DB (not
// just the JWT's baked-in claims), so a ban or consent change applied after
// a token was issued takes effect right away instead of waiting out the
// token's 7-day expiry. A deleted account is rejected the same way, as a
// natural side effect of the lookup. Writes the error response itself and
// returns null on failure so callers can just check for that and stop.
async function authenticate(req, res) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'missing or malformed Authorization header' });
    return null;
  }

  let user;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Rejects stale-shape tokens (e.g. issued before the JWT payload gained
    // fields) as 401 rather than letting a malformed req.user surface as a
    // confusing 400 downstream — 401 is what triggers the client's existing
    // re-login flow.
    user = ReportSubmitterDocument.parse(decoded);
  } catch (err) {
    res.status(401).json({ error: 'invalid or expired token' });
    return null;
  }

  let dbUser;
  try {
    dbUser = await getDb()
      .collection('users')
      .findOne({ _id: new ObjectId(user._id) }, { projection: { bannedSince: 1, consentedAt: 1 } });
  } catch (err) {
    res.status(500).json({ error: 'failed to verify account status' });
    return null;
  }

  if (!dbUser) {
    res.status(401).json({ error: 'invalid or expired token' });
    return null;
  }

  if (dbUser.bannedSince) {
    res.status(403).json({ error: 'account banned' });
    return null;
  }

  return { user, dbUser };
}

export async function requireAuth(req, res, next) {
  const result = await authenticate(req, res);
  if (!result) return;

  // We cannot collect any user data (reports, etc.) from an account that
  // hasn't consented to the privacy policy. 428 (Precondition Required) is
  // deliberately distinct from the 401/403 above so the client can route
  // this to a consent flow instead of a re-login or ban message.
  if (!result.dbUser.consentedAt) {
    return res.status(428).json({ error: 'consent required' });
  }

  req.user = result.user;
  next();
}

// Same identity/ban checks as requireAuth, but deliberately skips the
// consent check — used for the consent endpoints themselves (POST/DELETE
// /api/consent). Gating those behind "must already have consented" would
// make it impossible to ever grant consent in the first place. Exposes the
// account's current consentedAt on req so those routes don't need a second
// DB read just to see the value they're about to act on.
export async function requireAuthIgnoreConsent(req, res, next) {
  const result = await authenticate(req, res);
  if (!result) return;

  req.user = result.user;
  req.consentedAt = result.dbUser.consentedAt;
  next();
}
