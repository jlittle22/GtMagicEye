import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDb() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || undefined);
  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  // Matches GET /api/reports/last's query + sort exactly, so that lookup
  // stays an index scan instead of a full collection scan as reports grow.
  await db.collection('reports').createIndex({ cityId: 1, worldId: 1, insertedAt: -1 });
  // One document per city (upserted), so this doubles as the natural-key
  // constraint Mongo doesn't otherwise give you for "only one current state
  // row per city".
  await db.collection('cityState').createIndex({ worldId: 1, cityId: 1 }, { unique: true });
  // Supports "everything my alliance currently controls" lookups. Only
  // meaningful against the current-state projection — an index like this on
  // raw `reports` would invite queries that mix reports from before and
  // after an alliance change.
  await db.collection('cityState').createIndex({ worldId: 1, allianceId: 1 });
  // Same natural-key-constraint role as cityState's index, above — this is
  // the real Grepolis player identity (Game.player_id), not a stand-in.
  await db.collection('players').createIndex({ worldId: 1, playerId: 1 }, { unique: true });
  // Reverse lookup ("what's my player id in this world") for the subset of
  // players who are also a `users` account. Sparse because a player
  // observed only via someone else's supportDetails (not yet ingested, but
  // the schema allows for it) may have no submittedById at all — without
  // sparse, every such document would collide on a shared "missing field"
  // null under a plain unique index.
  await db.collection('players').createIndex(
    { worldId: 1, submittedById: 1 },
    { unique: true, sparse: true }
  );
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not connected yet');
  return db;
}
