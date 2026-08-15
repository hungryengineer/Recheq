#!/usr/bin/env node

/**
 * Apply database migrations to the target database.
 *
 * Usage: pnpm db:migrate
 *
 * Reads DATABASE_URL (works for local Postgres, Neon, and any Postgres URL).
 * Neon connection strings include sslmode=require, which postgres.js honours.
 *
 * Runs each SQL file in db/migrations in sorted order, tracking applied files
 * in the `tieout_migrations` table so the script is safe to re-run.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { loadEnvFile } from './lib/load-env.js';

loadEnvFile();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing required environment variable: DATABASE_URL');
  process.exit(1);
}

const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.error(`No .sql migrations found in ${migrationsDir}`);
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS tieout_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

  const applied = (await sql`SELECT name FROM tieout_migrations`) as { name: string }[];

  for (const file of files) {
    if (applied.some((row) => row.name === file)) {
      console.log(`  – ${file} already applied, skipping`);
      continue;
    }

    const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    await sql.unsafe(content);
    await sql`INSERT INTO tieout_migrations (name) VALUES (${file})`;

    console.log(`  ✓ ${file} applied`);
  }

  console.log('✅ Migrations up to date');
} finally {
  await sql.end();
}
