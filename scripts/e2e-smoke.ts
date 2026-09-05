// e2e-smoke.ts
import { SignJWT } from 'jose';

async function run() {
  console.log('--- CP3 Verification ---');

  const token = await new SignJWT({
    userId: '00000000-0000-0000-0000-000000000001',
    orgId: '00000000-0000-0000-0000-000000000002',
    role: 'verifier',
    email: 'test@recheq.dev',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(new TextEncoder().encode('supersecretjwtkeythatisverylong'));

  // 1. Create Case
  console.log('1. Creating Case');
  const caseReq = await fetch('http://localhost:3000/api/cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      candidate_name: 'E2E Test User',
      candidate_email: 'e2e@recheq.dev',
      employer_name: 'Tieout Corp',
      title: 'Software Engineer',
      claimed_ctc: 2500000,
      employment_start: '2023-01-01',
      employment_end: '2024-01-01',
    }),
  });
  const caseRes = await caseReq.json();
  const caseId = caseRes.data?.id;
  console.log(caseRes);
  if (caseReq.status !== 201) throw new Error('Create case failed');

  // 2. Grant Consent
  console.log('2. Granting Consent');
  const consentReq = await fetch(`http://localhost:3000/api/public/test-${caseId}/consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consent_text: 'I agree to the background check',
      consent_version: '1.0.0',
      ip_address: '127.0.0.1',
      user_agent: 'E2E-Runner/1.0',
    }),
  });
  const consentRes = await consentReq.json();
  if (consentRes.error) {
    console.dir(consentRes, { depth: null });
  }

  // 3. Upload Document
  console.log('3. Uploading Document');
  const formData = new FormData();
  // Create a simple text file blob that starts with PDF magic bytes
  const pdfMagicBytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xc3, 0xa4, 0xc3, 0xbc, 0xc3, 0xb6,
    0xc3, 0x9f, 0x0a,
  ]);
  const file = new Blob([pdfMagicBytes, 'sample payslip content'], { type: 'application/pdf' });
  formData.append('file', file, 'payslip.pdf');
  formData.append('kind', 'payslip');

  const docReq = await fetch(`http://localhost:3000/api/public/test-${caseId}/documents`, {
    method: 'POST',
    body: formData,
  });
  const docRes = await docReq.json();
  if (docRes.error) {
    console.dir(docRes, { depth: null });
  }

  // 4. Submit UAN
  console.log('4. Submitting UAN');
  const uanReq = await fetch(`http://localhost:3000/api/public/test-${caseId}/uan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uan: '100400000000',
    }),
  });
  const uanRes = await uanReq.json();
  if (uanRes.error) {
    console.dir(uanRes, { depth: null });
  }

  // 5. Submit Case
  console.log('5. Submitting Case');
  const submitReq = await fetch(`http://localhost:3000/api/public/test-${caseId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const submitRes = await submitReq.json();
  if (submitRes.error) {
    console.dir(submitRes, { depth: null });
  }

  // 6. Check Status
  console.log('6. Checking Status (Waiting 2s for background process)');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const statusReq = await fetch(`http://localhost:3000/api/public/test-${caseId}/status`);
  const statusRes = await statusReq.json();
  console.log(JSON.stringify(statusRes, null, 2));
}

run().catch(console.error);
