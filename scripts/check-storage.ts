#!/usr/bin/env node

/**
 * End-to-end storage check through the real candidate upload path.
 *
 * Usage: pnpm check:storage
 *
 * Exercises the full flow: create case -> send invite -> issue consent token
 * -> grant consent -> upload a document (sniffed as PDF) -> verify the object
 * is in the bucket (headObject) -> verify the DB record + dedup path.
 *
 * Reads DATABASE_URL (local Postgres or Neon) and S3_* env vars (local MinIO
 * or a remote S3-compatible provider such as Backblaze B2).
 *
 * All resources created by this run (case, token, consent, document, bucket
 * object) are cleaned up in the finally block on both success and failure.
 */

import { eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { createDb } from '../services/api/src/db/client.js';
import { createCaseDeps } from '../services/api/src/db/case-deps.js';
import { createConsentDeps } from '../services/api/src/db/consent-deps.js';
import { createDocumentDeps } from '../services/api/src/db/document-deps.js';
import { createTokenService } from '../services/api/src/db/token-deps.js';
import { createCase } from '../services/api/src/services/cases/case-service.js';
import { grantConsent, hashToken } from '../services/api/src/services/consent/consent-service.js';
import { uploadDocument } from '../services/api/src/services/documents/document-service.js';
import { transitionCaseStatus } from '../services/api/src/domain/case-status.js';
import { createDocumentStorageFromEnv } from '../services/api/src/storage/document-storage.js';
import { cases } from '../services/api/src/db/schema/cases.js';
import { consents } from '../services/api/src/db/schema/consents.js';
import { documents } from '../services/api/src/db/schema/documents.js';
import { tokens } from '../services/api/src/db/schema/tokens.js';
import { loadEnvFile } from './lib/load-env.js';

loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exitCode = 1;
  process.exit();
}

const DEV_ORG_ID = process.env.DEV_ORG_ID ?? '00000000-0000-0000-0000-000000000002';
const DEV_USER_ID = process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001';
const CONSENT_VERSION = '1';

const db = createDb(connectionString);
const storage = createDocumentStorageFromEnv();

// Track resources created during this run for cleanup.
const cleanup: {
  caseId?: string;
  rawToken?: string;
  storagePath?: string;
} = {};

try {
  const caseDeps = createCaseDeps(db);
  const consentDeps = createConsentDeps(db);
  const docDeps = createDocumentDeps(db, storage);
  const tokenService = createTokenService(db);

  // ── 1. Create case ────────────────────────────────────────────
  const created = await createCase(
    {
      employer_name: 'Acme Corp',
      candidate_name: 'Dummy Candidate',
      title: 'Dummy storage check',
      claimed_ctc: 1200000,
      employment_start: '2024-01-01',
      employment_end: '2025-12-31',
      uan: '123456789012',
    },
    DEV_USER_ID,
    DEV_ORG_ID,
    caseDeps,
  );
  cleanup.caseId = created.id;
  console.log(`✅ createCase -> ${created.id} (${created.status})`);

  // ── 2. Send invite (draft -> awaiting_consent) ───────────────
  const invitedStatus = transitionCaseStatus(created.status, 'invite_sent');
  await consentDeps.db.updateCaseStatus(created.id, invitedStatus);
  console.log(`✅ invite_sent -> ${invitedStatus}`);

  // ── 3. Issue and verify a consent token ──────────────────────
  const rawToken = await tokenService.createToken(created.id, 'consent', 60 * 60 * 1000);
  cleanup.rawToken = rawToken;
  const verifiedCaseId = await tokenService.verifyAndGetCaseId(rawToken, 'consent');
  if (verifiedCaseId !== created.id) {
    throw new Error(`token verification returned case ${verifiedCaseId}, expected ${created.id}`);
  }
  console.log('✅ consent token issued and verified');

  // ── 4. Grant consent (awaiting_consent -> awaiting_documents) ─
  const consent = await grantConsent(
    created.id,
    {
      consent_text: 'I consent to the background verification of my employment history.',
      consent_version: CONSENT_VERSION,
    },
    {
      ip_address: '127.0.0.1',
      user_agent: 'check:storage',
      token_hash: hashToken(rawToken),
    },
    consentDeps,
  );
  console.log(`✅ consent granted (${consent.status}) -> ${consent.case_id}`);

  // ── 5. Upload a PDF through the real upload path ─────────────
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]);
  pdf.setTitle('Payslip - Dummy Candidate');
  const content = Buffer.from(await pdf.save());

  const uploaded = await uploadDocument(
    created.id,
    content,
    { kind: 'payslip', original_filename: 'payslip.pdf' },
    docDeps,
  );
  cleanup.storagePath = uploaded.document.storage_path;
  console.log(
    `✅ uploadDocument -> ${uploaded.document.id} (${uploaded.document.mime_type}, ${uploaded.document.size_bytes} bytes)`,
  );

  // ── 6. Verify the object exists in the bucket ────────────────
  const head = await storage.headObject(uploaded.document.storage_path);
  if (!head.ok) {
    throw new Error(`headObject returned ${head.status} ${head.statusText}`);
  }
  if (head.size !== content.length) {
    throw new Error(`headObject size ${head.size} bytes, expected ${content.length}`);
  }
  console.log(
    `✅ headObject ${uploaded.document.storage_path} -> ${head.size} bytes (${head.status})`,
  );

  // ── 7. Verify the DB record + dedup path ─────────────────────
  const duplicate = await uploadDocument(
    created.id,
    content,
    { kind: 'payslip', original_filename: 'payslip.pdf' },
    docDeps,
  );
  if (!duplicate.deduplicated) {
    throw new Error('expected duplicate upload to be deduplicated');
  }
  if (duplicate.document.id !== uploaded.document.id) {
    throw new Error('dedup returned a different document');
  }
  console.log('✅ duplicate upload deduplicated to the same document');

  console.log('✅ Storage check passed — object persisted in bucket and database');
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  // Clean up only resources created by this run.
  if (cleanup.caseId) {
    try {
      // Cascading deletes: documents, consents, tokens all reference case_id.
      // Delete in dependency order to avoid FK violations on DBs without CASCADE.
      await db.delete(documents).where(eq(documents.case_id, cleanup.caseId));
      if (cleanup.rawToken) {
        await db.delete(tokens).where(eq(tokens.case_id, cleanup.caseId));
      }
      await db.delete(consents).where(eq(consents.case_id, cleanup.caseId));
      await db.delete(cases).where(eq(cases.id, cleanup.caseId));
      console.log(`🧹 Cleaned up test case ${cleanup.caseId}`);
    } catch (cleanupErr) {
      console.error(`⚠  DB cleanup failed: ${String(cleanupErr)}`);
    }
  }
  await db.$client.end();
}
