import { describe, it, expect } from 'vitest';
import type { ExtractionRequest } from '../src/extraction/llm-document-extractor.js';
import { RegexDocumentExtractor } from '../src/extraction/providers/regex-extractor.js';

function makeRequest(overrides: Partial<ExtractionRequest> = {}): ExtractionRequest {
  return {
    documentId: 'doc-1',
    documentKind: 'payslip',
    documentContent: 'some document text',
    mimeType: 'text/plain',
    schemaVersion: 'payslip-v1',
    ...overrides,
  };
}

describe('RegexDocumentExtractor edge-case guards', () => {
  const extractor = new RegexDocumentExtractor();

  it('refuses image documents for payslip', async () => {
    const result = await extractor.extractPayslip(
      makeRequest({ mimeType: 'image/jpeg', documentContent: 'garbage-bytes' }),
    );
    expect(result.status).toBe('failure');
    if (result.status === 'failure') {
      expect(result.error).toMatch(/image/);
    }
  });

  it('refuses image documents for form16', async () => {
    const result = await extractor.extractForm16(
      makeRequest({
        documentKind: 'form_16',
        schemaVersion: 'form16-v1',
        mimeType: 'image/png',
        documentContent: 'garbage-bytes',
      }),
    );
    expect(result.status).toBe('failure');
    if (result.status === 'failure') {
      expect(result.error).toMatch(/image/);
    }
  });

  it('refuses binary content containing NUL bytes', async () => {
    const binary = `PAN\x00\x00\x00 ABCPS1234F rest of the file`;
    const result = await extractor.extractPayslip(makeRequest({ documentContent: binary }));
    expect(result.status).toBe('failure');
    if (result.status === 'failure') {
      expect(result.error).toMatch(/not appear to be text/);
    }
  });

  it('refuses binary content with a high control-character ratio', async () => {
    const binary = '\u0001\u0002\u0003\u0004\u0005 A\u0006BC 12345';
    const result = await extractor.extractForm16(
      makeRequest({
        documentKind: 'form_16',
        schemaVersion: 'form16-v1',
        documentContent: binary,
      }),
    );
    expect(result.status).toBe('failure');
  });

  it('refuses mangled utf-8 content that would fabricate garbage fields', async () => {
    const mangledUtf8 = '\uFFFD\uFFFD\uFFFD\uFFFDnoise line\n\neof';
    const result = await extractor.extractPayslip(makeRequest({ documentContent: mangledUtf8 }));
    expect(result.status).toBe('failure');
    if (result.status === 'failure') {
      expect(result.error).toMatch(/not appear to be text/);
    }
  });

  it('extracts a PAN from valid text documents', async () => {
    const result = await extractor.extractForm16(
      makeRequest({
        documentKind: 'form_16',
        schemaVersion: 'form16-v1',
        documentContent: 'PAN ABCPS1234F\nGross Salary 100000.00',
      }),
    );
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.employee_pan).toBe('ABCPS1234F');
      expect(result.data.gross_total_income).toBe(100000);
    }
  });

  it('reports it cannot read images via metadata', () => {
    expect(extractor.getMetadata().supportsImages).toBe(false);
  });
});
