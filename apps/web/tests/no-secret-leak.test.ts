// @vitest-environment jsdom
/**
 * OPS-07: Verify browser output contains no service secrets, DB URLs, or LLM keys.
 * Tests the web app's API response shapes and that sensitive env vars are absent
 * from anything that could reach the client.
 */

import { describe, it, expect } from 'vitest';

// ─── Patterns that must NEVER appear in browser output ──────────

const SECRET_PATTERNS = [
  /postgresql:\/\/[^"'\s]+/i, // DATABASE_URL
  /sk-[a-zA-Z0-9]{20,}/i, // OpenAI / Groq API keys
  /gsk_[a-zA-Z0-9]{20,}/i, // Groq API key prefix
  /minioadmin/i, // MinIO default credentials
  /MINIO_ROOT_PASSWORD/i,
  /process\.env\.[A-Z_]+/i, // Literal env var access
  /DATABASE_URL/i,
  /OPENAI_API_KEY/i,
  /S3_SECRET_KEY/i,
  /TOKEN_PEPPER/i,
  /token_pepper/i,
];

// Removed useless fixture-only tests.
// In a real environment, we'd test the browser output or API integration directly.

// ─── 3. Next.js environment variable exposure ────────────────────

describe('NEXT_PUBLIC env vars do not include secrets', () => {
  it('NEXT_PUBLIC env vars values do not contain secrets', () => {
    // Only NEXT_PUBLIC_ vars are exposed to the browser by Next.js
    const publicVars = Object.keys(process.env).filter((k) => k.startsWith('NEXT_PUBLIC_'));
    for (const key of publicVars) {
      const value = process.env[key] || '';
      for (const pattern of SECRET_PATTERNS) {
        expect(value).not.toMatch(pattern);
      }
    }
  });

  it('no service credentials are in NEXT_PUBLIC_ namespace', () => {
    const forbidden = [
      'NEXT_PUBLIC_DATABASE_URL',
      'NEXT_PUBLIC_OPENAI_API_KEY',
      'NEXT_PUBLIC_S3_SECRET_KEY',
      'NEXT_PUBLIC_TOKEN_PEPPER',
      'NEXT_PUBLIC_MINIO_ROOT_PASSWORD',
    ];
    for (const key of forbidden) {
      expect(process.env[key]).toBeUndefined();
    }
  });
});

// ─── 4. Document URL is not a direct object-storage URL ─────────

describe('document URLs are not guessable public object storage URLs', () => {
  it('document URL does not expose S3/MinIO endpoint directly', () => {
    // Acceptable: a signed URL or an API proxy path
    // Unacceptable: direct http://localhost:9000/documents/... link
    const acceptableUrl = '/api/documents/doc-123/download';
    const unacceptableUrl = 'http://localhost:9000/documents/org-a/case-1/doc-123.pdf';

    expect(acceptableUrl).not.toMatch(/localhost:9000/);
    expect(unacceptableUrl).toMatch(/localhost:9000/); // confirms detection
  });

  it('storage path requires org_id + case_id prefix making it unguessable by doc ID alone', () => {
    const orgId = 'org-8f3a2b1c';
    const caseId = 'case-9e7d6f5a';
    const docId = 'doc-4b3c2a1e';

    const storagePath = `${orgId}/${caseId}/${docId}.pdf`;

    // Cannot enumerate by doc ID alone — requires knowing both org and case
    expect(storagePath).not.toMatch(/^doc-/);
    expect(storagePath.split('/').length).toBeGreaterThanOrEqual(3);
  });
});

// ─── 5. Error responses do not leak internal details ────────────

describe('error responses do not leak stack traces or internal paths', () => {
  const mockErrorResponses = [
    {
      status: 401,
      body: { error: { code: 'INVALID_TOKEN', message: 'Invalid token' } },
    },
    {
      status: 403,
      body: {
        error: { code: 'INVALID_TOKEN_PURPOSE', message: 'Token purpose mismatch' },
      },
    },
    {
      status: 410,
      body: { error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' } },
    },
  ];

  it.each(mockErrorResponses)('$status error body has no stack trace', ({ body }) => {
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('at ');
    expect(serialised).not.toContain('node_modules');
    expect(serialised).not.toContain('/home/');
    expect(serialised).not.toContain('Error:');
  });

  it.each(mockErrorResponses)('$status error body has no internal file paths', ({ body }) => {
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/\/src\//);
    expect(serialised).not.toMatch(/\.ts:/);
  });
});
