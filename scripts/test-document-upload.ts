import { createDb, schema } from '../services/api/src/db/client.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required');
  const db = createDb(dbUrl);

  console.log('1. Setting up test data...');

  // Create a dummy org
  const orgId = crypto.randomUUID();
  await db.insert(schema.organizations).values({
    id: orgId,
    name: 'Test Corp for Upload',
    slug: `test-corp-${Date.now()}`,
  });

  // Create a dummy case in 'awaiting_documents' state
  const caseId = crypto.randomUUID();
  await db.insert(schema.cases).values({
    id: caseId,
    org_id: orgId,
    created_by: process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001',
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

  // 2. Create a dummy minimal PDF file
  const dummyPdfPath = path.join(process.cwd(), 'dummy-payslip.pdf');
  // A minimal valid PDF structure
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n111\n%%EOF',
    'utf-8',
  );
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
    } catch (e) {
      console.error('Fetch failed:', e);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
