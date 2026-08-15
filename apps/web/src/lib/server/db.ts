import { createDb, type Database } from '@tieout/api/src/db/client.js';

const globalForDb = globalThis as unknown as {
  db: Database | undefined;
};

export function getDb(): Database {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is missing in environment variables');
    }
    globalForDb.db = createDb(url);
  }
  return globalForDb.db;
}

export const db = getDb();
