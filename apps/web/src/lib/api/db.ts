import { createDb, createCaseDeps } from '@tieout/api/web';
import type { CaseServiceDeps } from '@tieout/api/web';

export const DEV_ORG_ID = process.env.DEV_ORG_ID ?? '00000000-0000-0000-0000-000000000002';
export const DEV_USER_ID = process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001';

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
