#!/usr/bin/env node

/**
 * Quick database connectivity check.
 *
 * Usage: pnpm db:ping
 *
 * Connects using DATABASE_URL (loaded from .env.local unless already set in
 * the environment) and prints the server/database/tables. Exit 0 on success.
 */

import postgres from 'postgres';
import { loadEnvFile } from './lib/load-env.js';

loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set — paste it into .env.local (see .env.example)');
  process.exit(1);
}

const sql = postgres(connectionString, { connect_timeout: 10, max: 1 });

try {
  const rows = await sql`
    SELECT
      current_database() AS database,
      current_setting('server_version') AS version,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables
  `;
  const row = rows[0];
  if (!row) {
    throw new Error('empty result');
  }
  console.log(
    `✅ Connected to "${row.database}" (Postgres ${row.version}) — ${row.tables} table(s) in public schema`,
  );
} catch (error) {
  console.error(`❌ Could not connect: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
} finally {
  await sql.end();
}
