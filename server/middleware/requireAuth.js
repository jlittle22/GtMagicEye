import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { ReportSubmitterDocument } from '../database/reportDocument.js';
import { getDb } from '../db.js';

export async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing or malformed Authorization header' });
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
    return res.status(401).json({ error: 'invalid or expired token' });
  }

  // Re-checked against the DB (not just the JWT's baked-in claims) on every
  // request, so a ban applied after a token was issued takes effect right
  // away instead of waiting out the token's 7-day expiry. A deleted account
  // is rejected the same way, as a natural side effect of the lookup.
  let dbUser;
  try {
    dbUser = await getDb()
      .collection('users')
      .findOne({ _id: new ObjectId(user._id) }, { projection: { bannedSince: 1 } });
  } catch (err) {
    return res.status(500).json({ error: 'failed to verify account status' });
  }

  if (!dbUser) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }

  if (dbUser.bannedSince) {
    return res.status(403).json({ error: 'account banned' });
  }

  req.user = user;
  next();
}
