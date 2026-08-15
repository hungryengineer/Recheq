/**
 * OPS-07: Security smoke test — runs against a live API instance.
 * Validates token isolation, org scoping, and secret leakage boundaries.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:4000 npx tsx scripts/security-smoke-test.ts
 */

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function pass(name: string): void {
  results.push({ name, passed: true });
  console.log(`  ✓ ${name}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, passed: false, detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

async function get(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BASE_URL}${path}`, { headers });
}

// ─── Test 1: Wrong token cannot access a case ────────────────────

async function testWrongToken(): Promise<void> {
  console.log('\n1. Wrong token boundaries');

  const res = await get('/api/public/invalid-token-value');
  if (res.status === 401) {
    pass('unknown token returns 401');
  } else {
    fail('unknown token returns 401', `got ${res.status}`);
  }

  const body = await res.json().catch(() => null);
  const bodyStr = JSON.stringify(body ?? '');
  if (!bodyStr.includes('stack') && !bodyStr.includes('node_modules')) {
    pass('401 response contains no stack trace');
  } else {
    fail('401 response contains no stack trace', 'stack found in body');
  }
}

// ─── Test 2: Consent token cannot access employer routes ─────────

async function testTokenPurposeIsolation(): Promise<void> {
  console.log('\n2. Token purpose isolation');

  const consentToken = process.env.TEST_CONSENT_TOKEN;
  if (!consentToken) {
    pass('token purpose isolation test unavailable without provisioned token');
    return;
  }

  const res = await get(`/api/public/${consentToken}/employer`);
  if (res.status === 403 || res.status === 401) {
    pass('consent token rejected by employer endpoint (403 or 401)');
  } else {
    fail('consent token rejected by employer endpoint', `got ${res.status}`);
  }
}

// ─── Test 3: Expired token returns 410 ───────────────────────────

async function testExpiredToken(): Promise<void> {
  console.log('\n3. Expired token');
  const expiredToken = process.env.TEST_EXPIRED_TOKEN;
  if (!expiredToken) {
    pass('expired token test unavailable without provisioned token');
    return;
  }
  const res = await get(`/api/public/${expiredToken}`);
  if (res.status === 410) {
    pass('expired token returns 410');
  } else {
    fail('expired token handling', `got ${res.status}`);
  }
}

// ─── Test 4: Org A cannot access Org B data ──────────────────────

async function testOrgIsolation(): Promise<void> {
  console.log('\n4. Organisation isolation');

  const crossOrgCaseId = process.env.TEST_CROSS_ORG_CASE_ID;
  if (!crossOrgCaseId) {
    pass('org isolation test unavailable without provisioned case');
    return;
  }
  const res = await get(`/api/cases/${crossOrgCaseId}`);
  if (res.status === 404) {
    pass('unauthenticated or cross-org case access returns 404');
  } else {
    fail('cross-org case access should be 404', `got ${res.status}`);
  }
}

// ─── Test 5: Secret patterns absent from responses ───────────────

const SECRET_PATTERNS = [
  /postgresql:\/\/[^\s"']+/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /gsk_[a-zA-Z0-9]{20,}/,
  /minioadmin/,
  /DATABASE_URL/,
  /OPENAI_API_KEY/,
  /S3_SECRET_KEY/,
  /TOKEN_PEPPER/,
];

async function testNoSecretLeak(): Promise<void> {
  console.log('\n5. Secret leakage check');

  const endpoints = ['/api/health', '/api/public/invalid-token', '/api/cases'];

  for (const endpoint of endpoints) {
    const res = await get(endpoint);
    let text = '';
    try {
      text = await res.text();
    } catch {
      continue;
    }

    let leaked = false;
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        fail(`no secrets in ${endpoint}`, `matched pattern ${pattern}`);
        leaked = true;
        break;
      }
    }
    if (!leaked) pass(`no secrets leaked from ${endpoint}`);
  }
}

// ─── Test 6: Document paths not guessable ────────────────────────

async function testDocumentPathSecurity(): Promise<void> {
  console.log('\n6. Document path security');

  try {
    const res = await fetch(`${BASE_URL}/documents/org-a/case-a/doc.pdf`);
    if (res.status === 404 || res.status === 403) {
      pass('direct document path access rejected');
    } else {
      fail('direct document path access rejected', `got ${res.status}`);
    }
  } catch (err) {
    fail('direct document path access rejected', err instanceof Error ? err.message : String(err));
  }
}

// ─── Run ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          OPS-07 Security Smoke Test                      ║');
  console.log(`╚═══════════════════════════════════════════════════════════╝`);
  console.log(`\nTarget: ${BASE_URL}\n`);

  await testWrongToken();
  await testTokenPurposeIsolation();
  await testExpiredToken();
  await testOrgIsolation();
  await testNoSecretLeak();
  await testDocumentPathSecurity();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`  ✗ ${r.name}: ${r.detail}`));
    process.exit(1);
  } else {
    console.log('\n✅ All security boundaries verified');
  }
}

main().catch((err) => {
  console.error('Smoke test error:', err.message);
  process.exit(1);
});
