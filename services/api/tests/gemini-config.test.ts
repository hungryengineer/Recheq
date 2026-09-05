import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGeminiExtractor,
  createGeminiExtractorFromEnv,
  DEFAULT_EXTRACTION_MODEL,
} from '../src/extraction/providers/gemini-extractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const ENV_EXAMPLE = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

describe('gemini config', () => {
  it('DEFAULT_EXTRACTION_MODEL is gemini-3.6-flash', () => {
    expect(DEFAULT_EXTRACTION_MODEL).toBe('gemini-3.6-flash');
  });

  it('.env.example EXTRACTION_MODEL matches DEFAULT_EXTRACTION_MODEL', () => {
    const match = /^EXTRACTION_MODEL=(.+)$/m.exec(ENV_EXAMPLE);
    expect(match?.[1]?.trim()).toBe(DEFAULT_EXTRACTION_MODEL);
  });

  describe('model resolution via API call', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{}' }] } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('createGeminiExtractor defaults to DEFAULT_EXTRACTION_MODEL', async () => {
      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'text',
        mimeType: 'text/plain',
        schemaVersion: 'payslip-v1',
      });

      expect(result.modelId).toBe(DEFAULT_EXTRACTION_MODEL);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain(DEFAULT_EXTRACTION_MODEL);
    });

    it('createGeminiExtractorFromEnv uses EXTRACTION_MODEL override when set', async () => {
      const extractor = createGeminiExtractorFromEnv({
        GEMINI_API_KEY: 'test-key',
        EXTRACTION_MODEL: 'gemini-2.5-pro',
      });
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'text',
        mimeType: 'text/plain',
        schemaVersion: 'payslip-v1',
      });

      expect(result.modelId).toBe('gemini-2.5-pro');
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('gemini-2.5-pro');
    });

    it('createGeminiExtractorFromEnv falls back to DEFAULT when unset', async () => {
      const extractor = createGeminiExtractorFromEnv({
        GEMINI_API_KEY: 'test-key',
      });
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'text',
        mimeType: 'text/plain',
        schemaVersion: 'payslip-v1',
      });

      expect(result.modelId).toBe(DEFAULT_EXTRACTION_MODEL);
    });
  });
});
