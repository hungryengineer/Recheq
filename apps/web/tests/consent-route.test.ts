import { describe, it, expect } from 'vitest';
import { POST } from '../src/app/api/public/[token]/consent/route';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { vi } from 'vitest';

vi.mock('@recheq/api/web', () => {
  return {
    grantConsentHandler: vi.fn().mockResolvedValue({ status: 200, body: { success: true } }),
  };
});

describe('Consent Route', () => {
  it('should accept application/json content type without throwing invalid request body', async () => {
    // Create a mock Request
    const bodyStr = JSON.stringify({ consent: true });

    // Simulate the request as it arrives at the handler after the adapter
    const req = {
      raw: new Request('http://localhost/api/public/some-token/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: bodyStr,
      }),
      body: JSON.parse(bodyStr),
      params: { token: 'some-token' },
    };

    // The adapter already consumed the stream, so let's simulate it by actually consuming it on the raw request
    await req.raw.text();

    const response = await POST(req.raw, { params: Promise.resolve(req.params) });
    const json = await response.json();

    // It should NOT return 400 with "Invalid request body"
    expect(response.status).not.toBe(400);
    expect(json.message).not.toBe('Invalid request body');
  });
});

describe('No json() parsing in public routes', () => {
  it('should not contain request.json() or raw.json() in public routes', () => {
    const publicRoutesDir = path.resolve(__dirname, '../src/app/api/public');
    const files = readdirSync(publicRoutesDir, { recursive: true })
      .map((f) => String(f))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(publicRoutesDir, f));

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/(request|req|raw)\.json\(\)/);
    }
  });
});
