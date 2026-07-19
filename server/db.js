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
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not connected yet');
  return db;
}
