import jwt from 'jsonwebtoken';
import { ReportSubmitterDocument } from '../database/reportDocument.js';

export function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing or malformed Authorization header' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Rejects stale-shape tokens (e.g. issued before the JWT payload gained
    // fields) as 401 rather than letting a malformed req.user surface as a
    // confusing 400 downstream — 401 is what triggers the client's existing
    // re-login flow.
    req.user = ReportSubmitterDocument.parse(decoded);
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}
