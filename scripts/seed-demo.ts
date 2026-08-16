#!/usr/bin/env node

/**
 * Seed the demo organization, user, and the two browsable demo cases
 * (one CLEAN, one FORGED) that the dev app authenticates as.
 *
 * Usage:
 *   pnpm seed          # idempotent: re-running is a no-op
 *   pnpm seed:reset    # drops demo rows (org + user + cases) and re-creates
 *
 * Reads DATABASE_URL (local Postgres or Neon) and DEV_ORG_ID/DEV_USER_ID
 * (defaulting to the ids documented in .env.example).
 *
 * CLEAN case  → complete, verdict `verified`, risk_score 0.
 * FORGED case → complete, verdict `needs_review`, risk_score 80, with the two
 *               high findings from the doctored-01 demo fixture (pf-implies-basic,
 *               pf-matches-epfo) plus their hash-chained audit events.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { createDb, type Database } from '../services/api/src/db/client.js';
import { organizations } from '../services/api/src/db/schema/organizations.js';
import { users } from '../services/api/src/db/schema/users.js';
import { cases } from '../services/api/src/db/schema/cases.js';
import { consents } from '../services/api/src/db/schema/consents.js';
import { documents } from '../services/api/src/db/schema/documents.js';
import { extractions } from '../services/api/src/db/schema/extractions.js';
import { epfoRecords } from '../services/api/src/db/schema/epfo-records.js';
import { findings } from '../services/api/src/db/schema/findings.js';
import { events } from '../services/api/src/db/schema/events.js';
import { employerRequests } from '../services/api/src/db/schema/employer-requests.js';
import { AuditService } from '../services/api/src/audit/audit-service.js';
import { DbAuditRepository } from '../services/api/src/audit/db-audit-repository.js';
import { loadEnvFile } from './lib/load-env.js';
import type { EventInput } from '@tieout/schema';

// Seed the identity/credentials the dev app authenticates as, which live in the
// web app's env file. The repo-root .env.local may carry unrelated placeholders
// (e.g. OPENAI_API_KEY) that would fail the shared loader.
loadEnvFile(path.join('apps', 'web', '.env.local'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exitCode = 1;
  process.exit();
}

const DEV_ORG_ID = process.env.DEV_ORG_ID ?? '00000000-0000-0000-0000-000000000002';
const DEV_USER_ID = process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001';

const CLEAN_CASE_ID = '20000000-0000-0000-0000-000000000001';
const FORGED_CASE_ID = '20000000-0000-0000-0000-000000000002';

const CLEAN_CONSENT_ID = '20000000-0000-0000-0000-000000000011';
const FORGED_CONSENT_ID = '20000000-0000-0000-0000-000000000012';

const CLEAN_PAYSLIP_DOC_ID = '20000000-0000-0000-0000-000000000021';
const CLEAN_FORM16_DOC_ID = '20000000-0000-0000-0000-000000000022';
const FORGED_PAYSLIP_DOC_ID = '20000000-0000-0000-0000-000000000023';

const CLEAN_PAYSLIP_EXT_ID = '20000000-0000-0000-0000-000000000031';
const CLEAN_FORM16_EXT_ID = '20000000-0000-0000-0000-000000000032';
const FORGED_PAYSLIP_EXT_ID = '20000000-0000-0000-0000-000000000033';

const CLEAN_EPFO_RECORD_ID = '20000000-0000-0000-0000-000000000041';
const FORGED_EPFO_RECORD_ID = '20000000-0000-0000-0000-000000000042';

const FINDING_IDS = {
  cleanForensics: '20000000-0000-0000-0000-000000000051',
  forgedPfImpliesBasic: '20000000-0000-0000-0000-000000000052',
  forgedPfMatchesEpfo: '20000000-0000-0000-0000-000000000053',
  forgedForm16NotAssessed: '20000000-0000-0000-0000-000000000054',
  forgedIdentityNotAssessed: '20000000-0000-0000-0000-000000000055',
  forgedForensicsNotAssessed: '20000000-0000-0000-0000-000000000056',
} as const;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const db = createDb(connectionString);

// ─── Demo extraction payloads (single source of truth: fixture files) ──

const FIXTURES = path.join(ROOT, 'fixtures', 'extraction');
const EPFO_FIXTURES = path.join(ROOT, 'fixtures', 'epfo');

/**
 * Reads a JSON fixture file and returns the parsed object. Throws when the
 * file does not contain a non-null, non-array object.
 */
function readJson(filePath: string): Record<string, unknown> {
  const value: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Fixture ${filePath} must contain a JSON object`);
  }
  return value as Record<string, unknown>;
}
const CLEAN_PAYSLIP = readJson(path.join(FIXTURES, 'payslip-clean-01.json'));
const CLEAN_FORM16 = readJson(path.join(FIXTURES, 'form16-clean-01.json'));
const FORGED_PAYSLIP = readJson(path.join(FIXTURES, 'payslip-arun-doctored.json'));
const EPFO_CLEAN = readJson(path.join(EPFO_FIXTURES, 'arun-clean.json'));
const EPFO_DOCTORED = readJson(path.join(EPFO_FIXTURES, 'arun-doctored.json'));

/**
 * Computes a content fingerprint for a demo document PDF. When the file is
 * missing (ENOENT), falls back to a hash of the relative path and warns so the
 * operator can tell which fixture was absent. All other filesystem errors are
 * rethrown.
 */
function docFingerprint(relPath: string): { sha256: string; sizeBytes: number } {
  const abs = path.join(ROOT, relPath);
  try {
    const buf = fs.readFileSync(abs);
    return { sha256: crypto.createHash('sha256').update(buf).digest('hex'), sizeBytes: buf.length };
  } catch (err) {
    if (!isErrnoError(err) || err.code !== 'ENOENT') {
      throw err;
    }
    console.warn(`  ⚠️  Missing demo document ${relPath}; seeding a placeholder fingerprint.`);
    return { sha256: crypto.createHash('sha256').update(relPath).digest('hex'), sizeBytes: 0 };
  }
}

/** Returns true when the thrown value is a Node.js errno (filesystem) error. */
function isErrnoError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

// ─── Idempotency helper ─────────────────────────────────────────

/** Returns true when a case with the given id already exists in the database. */
async function caseExists(dbHandle: Database, caseId: string): Promise<boolean> {
  const rows = await dbHandle.select({ id: cases.id }).from(cases).where(eq(cases.id, caseId));
  return rows.length > 0;
}

// ─── Demo case seeding ──────────────────────────────────────────

/**
 * Seeds one demo case (documents, extractions, EPFO record, findings, and a
 * hash-chained audit trail) inside a single transaction. Skips the case if it
 * already exists so re-running `pnpm seed` is a no-op.
 */
async function seedCase(opts: {
  caseId: string;
  consentId: string;
  title: string;
  verdict: string;
  riskScore: number;
  uan: string;
  payslipDoc: {
    relPath: string;
    filename: string;
    extracted: Record<string, unknown>;
    extractionId: string;
    docId: string;
  };
  form16?: {
    relPath: string;
    filename: string;
    extracted: Record<string, unknown>;
    extractionId: string;
    docId: string;
  };
  epfo: { recordId: string; history: Record<string, unknown> };
  findingRows: Array<typeof findings.$inferInsert>;
  eventInputs: Array<{
    kind: EventInput['kind'];
    payload: Record<string, unknown>;
  }>;
}): Promise<void> {
  if (await caseExists(db, opts.caseId)) {
    console.log(`  ⏭  Skipping case ${opts.caseId} (already seeded)`);
    return;
  }

  await db.transaction(async (tx) => {
    const audit = new AuditService(new DbAuditRepository(db));

    await tx.insert(cases).values({
      id: opts.caseId,
      org_id: DEV_ORG_ID,
      created_by: DEV_USER_ID,
      employer_name: 'Acme Technologies Pvt Ltd',
      candidate_name: 'Arun Kumar',
      candidate_email: 'arun.kumar@example.com',
      title: opts.title,
      claimed_ctc: String(720000),
      employment_start: '2023-04-01',
      employment_end: '2026-03-31',
      uan: opts.uan,
      status: 'complete',
      verdict: opts.verdict,
      risk_score: opts.riskScore,
    });

    await tx.insert(consents).values({
      id: opts.consentId,
      case_id: opts.caseId,
      status: 'granted',
      consent_text: 'Demo consent for seeded fixture case.',
      consent_version: 'v1',
      granted_at: new Date(),
    });

    const payDoc = docFingerprint(opts.payslipDoc.relPath);
    await tx.insert(documents).values({
      id: opts.payslipDoc.docId,
      case_id: opts.caseId,
      kind: 'payslip',
      status: 'extracted',
      original_filename: opts.payslipDoc.filename,
      mime_type: 'application/pdf',
      sha256: payDoc.sha256,
      size_bytes: payDoc.sizeBytes,
      storage_path: opts.payslipDoc.relPath,
    });

    await tx.insert(extractions).values({
      id: opts.payslipDoc.extractionId,
      document_id: opts.payslipDoc.docId,
      model_id: 'demo-seed',
      schema_version: 'payslip-v1',
      status: 'success',
      extracted_data: opts.payslipDoc.extracted as never,
      completed_at: new Date(),
    });

    if (opts.form16) {
      const f16Doc = docFingerprint(opts.form16.relPath);
      await tx.insert(documents).values({
        id: opts.form16.docId,
        case_id: opts.caseId,
        kind: 'form_16',
        status: 'extracted',
        original_filename: opts.form16.filename,
        mime_type: 'application/pdf',
        sha256: f16Doc.sha256,
        size_bytes: f16Doc.sizeBytes,
        storage_path: opts.form16.relPath,
      });

      await tx.insert(extractions).values({
        id: opts.form16.extractionId,
        document_id: opts.form16.docId,
        model_id: 'demo-seed',
        schema_version: 'form16-v1',
        status: 'success',
        extracted_data: opts.form16.extracted as never,
        completed_at: new Date(),
      });
    }

    await tx.insert(epfoRecords).values({
      id: opts.epfo.recordId,
      case_id: opts.caseId,
      uan: opts.uan,
      consent_id: opts.consentId,
      employment_history: opts.epfo.history as never,
      status: 'success',
      completed_at: new Date(),
    });

    if (opts.findingRows.length > 0) {
      await tx.insert(findings).values(opts.findingRows);
    }

    for (const input of opts.eventInputs) {
      await audit.appendEvent(tx, {
        case_id: opts.caseId,
        kind: input.kind,
        payload: input.payload,
        actor: 'system',
      });
    }
  });

  console.log(`  ✓ Seeded case ${opts.caseId} (${opts.verdict}, score ${opts.riskScore})`);
}

// ─── Reset (seed:reset) ─────────────────────────────────────────

/**
 * Drops all rows belonging to the demo cases (events, findings, extractions,
 * documents, EPFO records, consents, employer requests, cases) in one
 * transaction. The shared dev org/user are left in place; the seed re-creates
 * them idempotently.
 */
async function resetDemo() {
  const demoCaseIds = [CLEAN_CASE_ID, FORGED_CASE_ID];

  await db.transaction(async (tx) => {
    for (const caseId of demoCaseIds) {
      await tx.delete(events).where(eq(events.case_id, caseId));
      await tx.delete(findings).where(eq(findings.case_id, caseId));
      const docRows = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.case_id, caseId));
      for (const row of docRows) {
        await tx.delete(extractions).where(eq(extractions.document_id, row.id));
      }
      await tx.delete(documents).where(eq(documents.case_id, caseId));
      const consentRows = await tx
        .select({ id: consents.id })
        .from(consents)
        .where(eq(consents.case_id, caseId));
      for (const row of consentRows) {
        await tx.delete(epfoRecords).where(eq(epfoRecords.consent_id, row.id));
      }
      await tx.delete(consents).where(eq(consents.case_id, caseId));
      await tx.delete(employerRequests).where(eq(employerRequests.case_id, caseId));
      await tx.delete(cases).where(eq(cases.id, caseId));
    }
  });

  // The dev org/user are the shared dev identity used by other (non-demo) rows,
  // so they are left in place; the seed re-creates them idempotently anyway.
}

// ─── Main ───────────────────────────────────────────────────────

try {
  const isReset = process.argv.includes('--reset');
  if (isReset) {
    console.log('🧹 Resetting demo data...');
    await resetDemo();
    console.log('  ✓ Demo data dropped');
  }

  console.log('🌱 Seeding demo org + user...');
  await db
    .insert(organizations)
    .values({ id: DEV_ORG_ID, name: 'Tieout Demo Org', slug: 'tieout-demo' })
    .onConflictDoNothing()
    .execute();

  await db
    .insert(users)
    .values({
      id: DEV_USER_ID,
      org_id: DEV_ORG_ID,
      email: 'demo@tieout.local',
      name: 'Tieout Demo User',
      role: 'verifier',
    })
    .onConflictDoNothing()
    .execute();

  console.log(`  ✓ Org ${DEV_ORG_ID} + user ${DEV_USER_ID}`);

  console.log('📁 Seeding CLEAN case...');
  await seedCase({
    caseId: CLEAN_CASE_ID,
    consentId: CLEAN_CONSENT_ID,
    title: 'Senior Software Engineer — March 2026 payslip',
    verdict: 'verified',
    riskScore: 0,
    uan: '100123456789',
    payslipDoc: {
      relPath: 'fixtures/documents/clean-01/payslip.pdf',
      filename: 'payslip.pdf',
      docId: CLEAN_PAYSLIP_DOC_ID,
      extractionId: CLEAN_PAYSLIP_EXT_ID,
      extracted: CLEAN_PAYSLIP,
    },
    form16: {
      relPath: 'fixtures/documents/clean-01/form16.pdf',
      filename: 'form16.pdf',
      docId: CLEAN_FORM16_DOC_ID,
      extractionId: CLEAN_FORM16_EXT_ID,
      extracted: CLEAN_FORM16,
    },
    epfo: { recordId: CLEAN_EPFO_RECORD_ID, history: EPFO_CLEAN },
    findingRows: [
      {
        id: FINDING_IDS.cleanForensics,
        case_id: CLEAN_CASE_ID,
        rule_id: 'forensics-metadata',
        severity: 'high',
        status: 'not_assessed',
        title: 'Document Forensics Unverified',
        explanation: 'Forensics analysis data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ],
    eventInputs: [
      { kind: 'case_created', payload: { title: 'Senior Software Engineer — March 2026 payslip' } },
      { kind: 'consent_granted', payload: {} },
      {
        kind: 'document_uploaded',
        payload: { document_id: CLEAN_PAYSLIP_DOC_ID, kind: 'payslip' },
      },
      { kind: 'document_uploaded', payload: { document_id: CLEAN_FORM16_DOC_ID, kind: 'form_16' } },
      {
        kind: 'extraction_completed',
        payload: { document_id: CLEAN_PAYSLIP_DOC_ID, schema_version: 'payslip-v1' },
      },
      {
        kind: 'extraction_completed',
        payload: { document_id: CLEAN_FORM16_DOC_ID, schema_version: 'form16-v1' },
      },
      { kind: 'epfo_lookup_completed', payload: { record_id: CLEAN_EPFO_RECORD_ID } },
      { kind: 'rules_executed', payload: { finding_count: 1 } },
      { kind: 'findings_persisted', payload: { count: 1 } },
      { kind: 'verdict_calculated', payload: { verdict: 'verified', risk_score: 0 } },
    ],
  });

  console.log('📁 Seeding FORGED case...');
  await seedCase({
    caseId: FORGED_CASE_ID,
    consentId: FORGED_CONSENT_ID,
    title: 'Senior Software Engineer — March 2026 payslip (suspected doctored)',
    verdict: 'needs_review',
    riskScore: 80,
    uan: '100123456789',
    payslipDoc: {
      relPath: 'fixtures/documents/doctored-01/payslip.pdf',
      filename: 'payslip.pdf',
      docId: FORGED_PAYSLIP_DOC_ID,
      extractionId: FORGED_PAYSLIP_EXT_ID,
      extracted: FORGED_PAYSLIP,
    },
    epfo: { recordId: FORGED_EPFO_RECORD_ID, history: EPFO_DOCTORED },
    findingRows: [
      {
        id: FINDING_IDS.forgedPfImpliesBasic,
        case_id: FORGED_CASE_ID,
        rule_id: 'pf-implies-basic',
        severity: 'high',
        status: 'open',
        title: 'PF Deduction Inconsistent with Declared Basic',
        explanation:
          'PF employee share of Rs. 3,600 implies a basic salary of Rs. 30,000 at the statutory 12% rate, but the declared basic is Rs. 52,000.',
        expected: 'Rs. 30,000',
        observed: 'Rs. 52,000',
        source_document_ids: [],
      },
      {
        id: FINDING_IDS.forgedPfMatchesEpfo,
        case_id: FORGED_CASE_ID,
        rule_id: 'pf-matches-epfo',
        severity: 'high',
        status: 'open',
        title: 'PF Deduction Does Not Match EPFO Record',
        explanation:
          'The payslip PF deduction (Rs. 3,600) does not match the employee share filed by Acme Technologies Pvt Ltd in EPFO for 2026-03 (Rs. 1,800). The employer files EPFO contributions independently.',
        expected: '1800',
        observed: '3600',
        source_document_ids: [],
      },
      {
        id: FINDING_IDS.forgedForm16NotAssessed,
        case_id: FORGED_CASE_ID,
        rule_id: 'form16-reconciles-payslip',
        severity: 'high',
        status: 'not_assessed',
        title: 'Form 16 / Payslip Reconciliation Unverified',
        explanation: 'Requires both Payslip and Form 16 extraction data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
      {
        id: FINDING_IDS.forgedIdentityNotAssessed,
        case_id: FORGED_CASE_ID,
        rule_id: 'identity-consistent',
        severity: 'high',
        status: 'not_assessed',
        title: 'Identity Consistency Unverified',
        explanation: 'Requires both Payslip and Form 16 to compare identities.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
      {
        id: FINDING_IDS.forgedForensicsNotAssessed,
        case_id: FORGED_CASE_ID,
        rule_id: 'forensics-metadata',
        severity: 'high',
        status: 'not_assessed',
        title: 'Document Forensics Unverified',
        explanation: 'Forensics analysis data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ],
    eventInputs: [
      {
        kind: 'case_created',
        payload: { title: 'Senior Software Engineer — March 2026 payslip (suspected doctored)' },
      },
      { kind: 'consent_granted', payload: {} },
      {
        kind: 'document_uploaded',
        payload: { document_id: FORGED_PAYSLIP_DOC_ID, kind: 'payslip' },
      },
      {
        kind: 'extraction_completed',
        payload: { document_id: FORGED_PAYSLIP_DOC_ID, schema_version: 'payslip-v1' },
      },
      { kind: 'epfo_lookup_completed', payload: { record_id: FORGED_EPFO_RECORD_ID } },
      { kind: 'rules_executed', payload: { finding_count: 5 } },
      { kind: 'findings_persisted', payload: { count: 5 } },
      { kind: 'verdict_calculated', payload: { verdict: 'needs_review', risk_score: 80 } },
    ],
  });

  console.log('\n✅ Seed complete');
} catch (err) {
  console.error(`❌ Seed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
