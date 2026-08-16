import { createDb, createCaseDeps } from '@tieout/api/web';
import type { CaseServiceDeps } from '@tieout/api/web';

/**
 * Development identity constants. Never fall back to hardcoded UUIDs in
 * production — require explicitly configured values and fail closed.
 */
function requireDevId(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `${name} is not set. In production, all identity constants must be explicitly configured.`,
      );
    }
    // Documented defaults for local development only.
    return name === 'DEV_ORG_ID'
      ? '00000000-0000-0000-0000-000000000002'
      : '00000000-0000-0000-0000-000000000001';
  }
  return value;
}

export const DEV_ORG_ID = requireDevId('DEV_ORG_ID');
export const DEV_USER_ID = requireDevId('DEV_USER_ID');

const globalForDb = globalThis as unknown as { __tieoutDb?: ReturnType<typeof createDb> };

export function getDb(): ReturnType<typeof createDb> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add it to apps/web/.env.local (see .env.example) or Vercel env vars.',
    );
  }
  if (!globalForDb.__tieoutDb) {
    globalForDb.__tieoutDb = createDb(url);
  }
  return globalForDb.__tieoutDb;
}

export function getCaseDeps(): CaseServiceDeps {
  return createCaseDeps(getDb());
}
