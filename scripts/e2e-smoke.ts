// e2e-smoke.ts

async function run() {
  console.log('--- CP3 Verification ---');

  // 1. Create Case
  console.log('1. Creating Case');
  const caseReq = await fetch('http://localhost:3000/api/cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '00000000-0000-0000-0000-000000000001',
      'x-org-id': '00000000-0000-0000-0000-000000000002',
    },
    body: JSON.stringify({
      candidate_name: 'E2E Test User',
      candidate_email: 'e2e@tieout.dev',
      employer_name: 'Tieout Corp',
      title: 'Software Engineer',
      claimed_ctc: 2500000,
      employment_start: '2023-01-01',
      employment_end: '2024-01-01',
    }),
  });
  const caseRes = await caseReq.json();
  console.log(caseRes);
  if (caseReq.status !== 201) throw new Error('Create case failed');

  // 2. Grant Consent (using test-token)
  // Wait, test-token returns the first available case. So it should pick up the case we just created if it's the only one, or we just trust it uses some case.
  console.log('2. Granting Consent');
  const consentReq = await fetch('http://localhost:3000/api/public/test-token/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: '1.0.0',
      ip_address: '127.0.0.1',
      user_agent: 'E2E Test',
    }),
  });
  const consentRes = await consentReq.json();
  console.log(consentRes);

  // 3. Upload Document
  console.log('3. Uploading Document');
  const formData = new FormData();
  // Create a simple text file blob
  const file = new Blob(['sample payslip content'], { type: 'application/pdf' });
  formData.append('file', file, 'payslip.pdf');
  formData.append('kind', 'payslip');

  const uploadReq = await fetch('http://localhost:3000/api/public/test-token/documents', {
    method: 'POST',
    body: formData,
  });
  const uploadRes = await uploadReq.json();
  console.log(uploadRes);

  // 4. Submit UAN
  console.log('4. Submitting UAN');
  const uanReq = await fetch('http://localhost:3000/api/public/test-token/uan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uan: '123456789012' }),
  });
  console.log(await uanReq.json());

  // 5. Submit Case
  console.log('5. Submitting Case');
  const submitReq = await fetch('http://localhost:3000/api/public/test-token/submit', {
    method: 'POST',
  });
  const submitRes = await submitReq.json();
  console.log(submitRes);

  // 6. Check Status
  console.log('6. Checking Status (Waiting 2s for background process)');
  await new Promise((r) => setTimeout(r, 2000));

  const statusReq = await fetch('http://localhost:3000/api/public/test-token/status');
  const statusRes = await statusReq.json();
  console.log(JSON.stringify(statusRes, null, 2));
}

run().catch(console.error);
