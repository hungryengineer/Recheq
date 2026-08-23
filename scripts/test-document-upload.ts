import { createDb, schema } from '../services/api/src/db/client.js';
import { eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

// Cleanup bookkeeping: only rows created by this run are removed.
const created = {
  orgId: null as string | null,
  caseId: null as string | null,
  userId: null as string | null,
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required');

  // Guard against pointing this fixture-seeding script at a real database.
  const isLocalDb = /(@|\/\/)(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);
  if (!isLocalDb && process.env.ALLOW_REMOTE_TEST_DB !== 'yes') {
    throw new Error(
      'Refusing to seed a non-local database. Set ALLOW_REMOTE_TEST_DB=yes to override.',
    );
  }

  const db = createDb(dbUrl);

  console.log('1. Setting up test data...');

  // Create a dummy org
  const orgId = crypto.randomUUID();
  created.orgId = orgId;
  await db.insert(schema.organizations).values({
    id: orgId,
    name: 'Test Corp for Upload',
    slug: `test-corp-${Date.now()}`,
  });

  // Ensure the fallback user exists before referencing it as created_by
  const devUserId = process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001';
  const existing = await db.select().from(schema.users).where(eq(schema.users.id, devUserId));
  if (existing.length === 0) {
    const inserted = await db
      .insert(schema.users)
      .values({
        id: devUserId,
        org_id: orgId,
        email: 'upload-test-runner@tieout.test',
        name: 'Upload Test Runner',
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) {
      created.userId = devUserId;
    } else {
      throw new Error(`DEV_USER_ID ${devUserId} does not exist and could not be created`);
    }
  }

  // Create a dummy case in 'awaiting_documents' state
  const caseId = crypto.randomUUID();
  created.caseId = caseId;
  await db.insert(schema.cases).values({
    id: caseId,
    org_id: orgId,
    created_by: devUserId,
    employer_name: 'Acme Corp',
    candidate_name: 'Jane Doe Upload Test',
    candidate_email: `jane.upload.${Date.now()}@example.com`,
    title: 'Upload flow test',
    claimed_ctc: '1200000.00',
    employment_start: '2024-01-01',
    employment_end: '2025-12-31',
    status: 'awaiting_documents',
  });

  // Create a token for the candidate. Tokens are stored by their SHA-256
  // hash; the raw value only ever appears in the candidate-facing URL.
  const tokenValue = crypto.randomBytes(32).toString('base64url');
  await db.insert(schema.tokens).values({
    hash: crypto.createHash('sha256').update(tokenValue).digest('hex'),
    case_id: caseId,
    purpose: 'consent',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  console.log(`✅ Created Case ID: ${caseId}`);
  console.log(`✅ Generated Token: ${tokenValue}`);

  // 2. Create a structurally valid PDF via pdf-lib
  const dummyPdfPath = path.join(process.cwd(), 'dummy-payslip.pdf');
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  doc.setTitle('Payslip - Upload Test');
  const minimalPdf = Buffer.from(await doc.save());
  fs.writeFileSync(dummyPdfPath, minimalPdf);
  console.log(`✅ Created dummy PDF file: ${dummyPdfPath}`);

  // 3. Construct the cURL command
  const apiUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const endpoint = `${apiUrl}/api/public/${tokenValue}/documents`;

  console.log('\n==================================================');
  console.log('🚀 READY TO TEST UPLOAD 🚀');
  console.log('==================================================');
  console.log('To test the upload endpoint, run the following cURL command:\n');

  const curlCommand = `curl -X POST "${endpoint}" \\
  -F "kind=payslip" \\
  -F "file=@${dummyPdfPath}"`;

  console.log(curlCommand);
  console.log(
    '\nOr, if you want this script to automatically perform the fetch, run it again with the --run flag.',
  );

  // 4. Optionally run the fetch
  if (process.argv.includes('--run')) {
    console.log('\nExecuting fetch...');
    const formData = new FormData();
    formData.append('kind', 'payslip');

    // Convert buffer to Blob for fetch
    const fileBlob = new Blob([minimalPdf], { type: 'application/pdf' });
    formData.append('file', fileBlob, 'dummy-payslip.pdf');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const responseBody = await response.json();
      console.log(`Response Status: ${response.status}`);
      console.dir(responseBody, { depth: null });
      if (!response.ok) {
        process.exitCode = 1;
      }
    } catch (e) {
      console.error('Fetch failed:', e);
      process.exitCode = 1;
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Best-effort cleanup of every row this run created. FKs have no ON
    // DELETE CASCADE here, so go children-first: documents/events/tokens
    // reference the case; the case and (only if we created it) the user
    // reference the organization.
    if (!created.orgId) return;
    try {
      const dbUrl = process.env.DATABASE_URL!;
      const db = createDb(dbUrl);
      if (created.caseId) {
        await db.delete(schema.documents).where(eq(schema.documents.case_id, created.caseId));
        await db.delete(schema.events).where(eq(schema.events.case_id, created.caseId));
        await db.delete(schema.tokens).where(eq(schema.tokens.case_id, created.caseId));
        await db.delete(schema.cases).where(eq(schema.cases.id, created.caseId));
        console.log(`🧹 Cleaned up test case ${created.caseId}`);
      }
      if (created.userId) {
        await db.delete(schema.users).where(eq(schema.users.id, created.userId));
        console.log('🧹 Cleaned up test user');
      }
      await db.delete(schema.organizations).where(eq(schema.organizations.id, created.orgId));
      console.log(`🧹 Cleaned up test org ${created.orgId}`);
      await db.$client.end();
    } catch (cleanupErr) {
      console.error('⚠ Cleanup failed:', cleanupErr);
    }
  });
