#!/usr/bin/env node

/**
 * Apply database migrations to the target database.
 *
 * Usage: pnpm db:migrate
 *
 * Reads DATABASE_URL (works for local Postgres, Neon, and any Postgres URL).
 * Neon connection strings include sslmode=require, which postgres.js honours.
 *
 * Each migration is executed inside its own transaction with a session-level
 * advisory lock (pg_advisory_xact_lock) so parallel runners coordinate safely.
 * The tracking insert is included in the same transaction, making the whole
 * operation atomic: either both the migration and its tracking row commit, or
 * neither does.
 *
 * Migration files that contain their own BEGIN/COMMIT (e.g. DDL-only files
 * that require autocommit) are executed with sql.unsafe() outside a wrapping
 * transaction — the file content is run as-is. Those files must not use
 * advisory locks.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { loadEnvFile } from './lib/load-env.js';

loadEnvFile();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing required environment variable: DATABASE_URL');
  process.exitCode = 1;
  process.exit();
}

const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
let files: string[];
try {
  files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
} catch (err) {
  console.error(`Cannot read migrations directory ${migrationsDir}: ${String(err)}`);
  process.exitCode = 1;
  process.exit();
}

if (files.length === 0) {
  console.error(`No .sql migrations found in ${migrationsDir}`);
  process.exitCode = 1;
  process.exit();
}

const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

try {
  // Ensure the tracking table exists (outside any migration transaction).
  await sql`
    CREATE TABLE IF NOT EXISTS tieout_migrations (
      name       text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = (await sql`SELECT name FROM tieout_migrations`) as { name: string }[];

  for (const file of files) {
    if (applied.some((row) => row.name === file)) {
      console.log(`  – ${file} already applied, skipping`);
      continue;
    }

    const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');

    // Detect whether the file manages its own transaction (autocommit required,
    // e.g. CREATE DATABASE, VACUUM, or migrations with explicit BEGIN/COMMIT).
    const needsAutocommit = /^\s*(BEGIN|START\s+TRANSACTION)/im.test(content);

    if (needsAutocommit) {
      // Run as-is; the file's own transaction wraps the DDL.
      await sql.unsafe(content);
      await sql`INSERT INTO tieout_migrations (name) VALUES (${file})`;
    } else {
      // Wrap in a transaction with an advisory lock so concurrent runners
      // cannot apply the same migration simultaneously.
      await sql.begin(async (tx) => {
        // Lock key is the first 32 bits of the file name's hash — stable and
        // deterministic across runners without a shared sequence.
        const lockKey = file
          .split('')
          .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
        await tx`SELECT pg_advisory_xact_lock(${lockKey})`;

        // Re-check inside the transaction in case a concurrent runner just
        // committed the same migration while we were waiting for the lock.
        const alreadyApplied =
          await tx`SELECT 1 FROM tieout_migrations WHERE name = ${file}`;
        if (alreadyApplied.length > 0) {
          console.log(`  – ${file} applied by concurrent runner, skipping`);
          return;
        }

        await tx.unsafe(content);
        await tx`INSERT INTO tieout_migrations (name) VALUES (${file})`;
      });
    }

    console.log(`  ✓ ${file} applied`);
  }

  console.log('✅ Migrations up to date');
} catch (err) {
  console.error(`❌ Migration failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
