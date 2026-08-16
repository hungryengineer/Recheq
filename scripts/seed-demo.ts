#!/usr/bin/env node

/**
 * Seed the demo organization + user that the dev app authenticates as.
 *
 * Usage: pnpm seed:demo
 *
 * Reads DATABASE_URL (local Postgres or Neon) and DEV_ORG_ID/DEV_USER_ID
 * (defaulting to the ids documented in .env.example). Idempotent: re-running
 * is a no-op thanks to onConflictDoNothing.
 */

import { createDb } from '../services/api/src/db/client.js';
import { organizations } from '../services/api/src/db/schema/organizations.js';
import { users } from '../services/api/src/db/schema/users.js';
import { loadEnvFile } from './lib/load-env.js';
import bcrypt from 'bcryptjs';

loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exitCode = 1;
  process.exit();
}

const DEV_ORG_ID = process.env.DEV_ORG_ID ?? '00000000-0000-0000-0000-000000000002';
const DEV_USER_ID = process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001';

const db = createDb(connectionString);

try {
  await db
    .insert(organizations)
    .values({ id: DEV_ORG_ID, name: 'Tieout Demo Org', slug: 'tieout-demo' })
    .onConflictDoNothing()
    .execute();

  const password_hash = await bcrypt.hash('password123', 10);

  await db
    .insert(users)
    .values({
      id: DEV_USER_ID,
      org_id: DEV_ORG_ID,
      email: 'demo@tieout.local',
      password_hash,
      name: 'Tieout Demo User',
      role: 'admin',
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { password_hash, role: 'admin' },
    })
    .execute();

  console.log(`✅ Seeded org ${DEV_ORG_ID} + user ${DEV_USER_ID}`);
} catch (err) {
  console.error(`❌ Seed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
