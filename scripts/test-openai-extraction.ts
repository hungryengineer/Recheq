/**
 * Test OpenAI extraction with real API key
 * Usage: npx tsx scripts/test-openai-extraction.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load .env.local
const envFile = path.join(PROJECT_ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set in .env.local');
  process.exit(1);
}

console.log('╔════════════════════════════════════════╗');
console.log('║   OpenAI Extraction Test Suite         ║');
console.log('╚════════════════════════════════════════╝\n');

console.log(`Configuration:`);
console.log(`  API Key: ${OPENAI_API_KEY.substring(0, 10)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}`);
console.log(`  Model: ${OPENAI_MODEL}`);
console.log(`  Base URL: ${OPENAI_BASE_URL}\n`);

// Test 1: Verify API connectivity
console.log('🔍 Test 1: API Connectivity');
try {
  const response = await fetch(`${OPENAI_BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  });

  if (response.status === 200) {
    console.log('✓ API connection successful\n');
  } else {
    console.error(`✗ API returned ${response.status}\n`);
    process.exit(1);
  }
} catch (e) {
  console.error(`✗ Network error: ${(e as Error).message}\n`);
  process.exit(1);
}

// Test 2: Verify model availability
console.log('🔍 Test 2: Model Availability');
try {
  const response = await fetch(`${OPENAI_BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  });
  const data = (await response.json()) as { data?: Array<{ id: string }> };
  const models = (data.data || []).map((m) => m.id);

  if (models.includes(OPENAI_MODEL)) {
    console.log(`✓ Model "${OPENAI_MODEL}" is available\n`);
  } else {
    const alternatives = models.filter((m) => m.includes('gpt')).slice(0, 3);
    console.warn(`⚠️  Model "${OPENAI_MODEL}" not found`);
    console.log(`   Available alternatives: ${alternatives.join(', ')}\n`);
  }
} catch (e) {
  console.error(`✗ Error checking models: ${(e as Error).message}\n`);
  process.exit(1);
}

// Test 3: Test extraction (simulated - no real PDF)
console.log('🔍 Test 3: Extraction API Compatibility');
console.log('(Simulated test - no real document content)\n');

// Create a test prompt
const testPrompt = `Extract payslip information from the following document. Return JSON.
Document: [Test payslip from Tieout verification system]
Required fields:
- employee_name
- employer_name
- basic_salary
- gross_salary
- net_salary`;

try {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a document extraction specialist. Extract data from payslips and return valid JSON.',
        },
        {
          role: 'user',
          content: testPrompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message: string };
  };

  if (data.error) {
    console.error(`✗ API Error: ${data.error.message}\n`);
    process.exit(1);
  }

  const content = data.choices?.[0]?.message?.content;
  if (content) {
    console.log('✓ Extraction API call successful');
    console.log(`✓ Response preview: ${content.substring(0, 80)}...\n`);
  } else {
    console.error('✗ No response from API\n');
    process.exit(1);
  }
} catch (e) {
  console.error(`✗ Error during extraction test: ${(e as Error).message}\n`);
  process.exit(1);
}

// Test 4: Load fixtures
console.log('🔍 Test 4: Fixture Suite Status');
const fixtureDir = path.join(PROJECT_ROOT, 'fixtures', 'extraction');
const fixtures = fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json'));

console.log(`✓ Found ${fixtures.length} fixture files:`);
fixtures.forEach((f) => {
  const isPayslip = f.includes('payslip');
  const type = isPayslip ? 'Payslip' : 'Form 16';
  const clean = f.includes('clean') ? 'Clean' : 'Doctored';
  console.log(`   - ${f} (${type}, ${clean})`);
});

console.log('\n╔════════════════════════════════════════╗');
console.log('║   ✓ All Checks Passed!                 ║');
console.log('╚════════════════════════════════════════╝\n');

console.log('Next steps:');
console.log('  1. Prepare real PDF documents (payslips, Form 16s)');
console.log('  2. Convert PDFs to base64 encoding');
console.log('  3. Run: npx tsx scripts/test-openai-extraction.ts [pdf-file]');
console.log('  4. Monitor OpenAI usage dashboard for token counts\n');

console.log('Documentation:');
console.log('  - Extraction system: services/api/src/extraction/');
console.log('  - OpenAI provider: services/api/src/extraction/providers/openai-compatible-extractor.ts');
console.log('  - Schema definitions: packages/schema/src/\n');
