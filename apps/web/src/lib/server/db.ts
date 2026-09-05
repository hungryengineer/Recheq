import { createDb, type Database } from '@recheq/api/src/db/client.js';

declare global {
  var __db: Database | undefined;
}

const globalForDb = globalThis as {
  __db: Database | undefined;
};

export function getDb(): Database {
  if (!globalForDb.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is missing in environment variables');
    }
    globalForDb.__db = createDb(url);
  }
  return globalForDb.__db;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    return getDb()[prop as keyof Database];
  },
});
