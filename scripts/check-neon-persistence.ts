#!/usr/bin/env node

/**
 * Dummy end-to-end persistence check.
 *
 * Usage: pnpm check:neon
 *
 * Creates a case through the real service code path (case-service + drizzle
 * deps adapter backed by createDb) and verifies the row is retrievable from
 * the database. Reads DATABASE_URL (local Postgres or Neon).
 */

import { createDb } from '../services/api/src/db/client.js';
import { createCaseDeps } from '../services/api/src/db/case-deps.js';
import { createCase, getCase, listCases } from '../services/api/src/services/cases/case-service.js';
import { loadEnvFile } from './lib/load-env.js';

loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const DEV_ORG_ID = process.env.DEV_ORG_ID ?? '00000000-0000-0000-0000-000000000002';
const DEV_USER_ID = process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001';

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`❌ ${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

const db = createDb(connectionString);
const deps = createCaseDeps(db);

const input = {
  employer_name: 'Acme Corp',
  candidate_name: 'Dummy Candidate',
  title: 'Dummy persistence check',
  claimed_ctc: 1200000,
  employment_start: '2024-01-01',
  employment_end: '2025-12-31',
  uan: '123456789012',
};

try {
  const created = await createCase(input, DEV_USER_ID, DEV_ORG_ID, deps);
  console.log(`✅ createCase -> ${created.id} (${created.status})`);

  const fetched = await getCase(created.id, DEV_ORG_ID, deps);
  assertEqual(fetched.employer_name, 'Acme Corp', 'employer_name');
  assertEqual(fetched.candidate_name, 'Dummy Candidate', 'candidate_name');
  assertEqual(fetched.claimed_ctc, 1200000, 'claimed_ctc');
  assertEqual(fetched.uan, '123456789012', 'uan');
  assertEqual(fetched.status, 'draft', 'status');
  console.log('✅ getCase returned persisted values');

  const listed = await listCases(DEV_ORG_ID, deps);
  if (!listed.some((c) => c.id === created.id)) {
    throw new Error('❌ listCases does not include the created case');
  }
  console.log(`✅ listCases includes ${created.id} (${listed.length} total)`);

  console.log('✅ Case persisted in database — dummy check passed');
} finally {
  await db.$client.end();
}
