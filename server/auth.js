import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import { UserDocument } from './database/userDocument.js';

const SALT_ROUNDS = 10;

export async function registerUser(username, password) {
  const users = getDb().collection('users');

  const existing = await users.findOne({ username });
  if (existing) {
    const err = new Error('username already taken');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const doc = UserDocument.parse({ username, passwordHash, createdAt: new Date() });
  await users.insertOne(doc);
}

export async function loginUser(username, password) {
  const users = getDb().collection('users');

  const user = await users.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const err = new Error('invalid credentials');
    err.status = 401;
    throw err;
  }

  // Checked after the password compare (not before) so a wrong-password
  // attempt on a banned username still just gets "invalid credentials",
  // not a signal that the account exists and is banned.
  if (user.bannedSince) {
    const err = new Error('account banned');
    err.status = 403;
    throw err;
  }

  await users.updateOne({ _id: user._id }, { $set: { lastLoggedInAt: new Date() } });

  // Explicit allowlist (not a spread-minus-passwordHash): keeps any future
  // sensitive field off the JWT by default, and covers documents created
  // before a field like `approvedAt` existed, which won't have it stored at
  // all (schema defaults only apply on insert, not retroactively).
  const safeUser = {
    _id: user._id,
    username: user.username,
    approvedAt: user.approvedAt ?? null,
    createdAt: user.createdAt,
  };

  // TODO: revisit claims + expiry once auth requirements are finalized.
  return jwt.sign(safeUser, process.env.JWT_SECRET, { expiresIn: '7d' });
}
