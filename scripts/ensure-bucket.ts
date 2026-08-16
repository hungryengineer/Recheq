#!/usr/bin/env node

/**
 * Ensure the object storage bucket exists (creates it if missing).
 *
 * Usage: pnpm storage:setup
 *
 * Reads S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET.
 * Works with local MinIO and remote S3-compatible providers such as
 * Cloudflare R2 (path-style URLs are the default).
 */

import { ensureStorageBucket } from '../services/api/src/storage/storage-health.js';
import { loadEnvFile } from './lib/load-env.js';

loadEnvFile();

try {
  const result = await ensureStorageBucket();

  if (result.ok) {
    console.log(`✅ Bucket "${result.bucket}" is ready (${result.message})`);
  } else {
    console.error(`❌ ${result.message}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
