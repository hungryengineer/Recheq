import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadDocument, type DocumentServiceDeps } from '../src/services/documents/document-service.js';
import { sniffMimeType, isAllowedMimeType } from '../src/services/documents/mime-sniffer.js';
import { AppError } from '../src/http/errors.js';
import type { CaseRecord, DocumentRecord } from '@tieout/schema';

// ─── Test Helpers ───────────────────────────────────────────────

function makeCaseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-001',
    org_id: 'org-001',
    created_by: 'user-001',
    employer_name: 'Acme Corp',
    candidate_name: 'Jane Doe',
    title: 'Senior Engineer BGV',
    claimed_ctc: 1800000,
    employment_start: '2021-01-01',
    employment_end: '2023-12-31',
    uan: null,
    status: 'awaiting_documents',
    verdict: null,
    risk_score: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDocumentRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-001',
    case_id: 'case-001',
    kind: 'payslip',
    status: 'pending',
    original_filename: 'payslip_jan_2023.pdf',
    mime_type: 'application/pdf',
    sha256: 'a'.repeat(64),
    size_bytes: 1024,
    storage_path: 'org-001/case-001/doc-001.pdf',
    uploaded_at: '2024-01-03T10:00:00Z',
    ...overrides,
  };
}

function makeDeps(): DocumentServiceDeps {
  return {
    db: {
      getCaseById: vi.fn(),
      getDocumentByCaseAndSha: vi.fn(),
      createDocument: vi.fn(),
    },
    storage: {
      putObject: vi.fn().mockResolvedValue(undefined),
    },
  };
}

/** Creates a Buffer with a PDF magic byte header */
function makePdfContent(sizeBytes = 1024): Buffer {
  const content = Buffer.alloc(sizeBytes);
  // PDF magic bytes: %PDF
  content[0] = 0x25;
  content[1] = 0x50;
  content[2] = 0x44;
  content[3] = 0x46;
  return content;
}

/** Creates a Buffer with a JPEG magic byte header */
function makeJpegContent(sizeBytes = 512): Buffer {
  const content = Buffer.alloc(sizeBytes);
  // JPEG magic bytes: FF D8 FF
  content[0] = 0xff;
  content[1] = 0xd8;
  content[2] = 0xff;
  return content;
}

/** Creates a Buffer with a PNG magic byte header */
function makePngContent(sizeBytes = 512): Buffer {
  const content = Buffer.alloc(sizeBytes);
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngHeader.length; i++) {
    content[i] = pngHeader[i]!;
  }
  return content;
}

const validMetadata = {
  kind: 'payslip' as const,
  original_filename: 'payslip_jan_2023.pdf',
};

// ─── MIME Sniffer ───────────────────────────────────────────────

describe('sniffMimeType', () => {
  it('detects PDF from magic bytes', () => {
    const result = sniffMimeType(makePdfContent());
    expect(result).toEqual({ mimeType: 'application/pdf', extension: 'pdf' });
  });

  it('detects JPEG from magic bytes', () => {
    const result = sniffMimeType(makeJpegContent());
    expect(result).toEqual({ mimeType: 'image/jpeg', extension: 'jpg' });
  });

  it('detects PNG from magic bytes', () => {
    const result = sniffMimeType(makePngContent());
    expect(result).toEqual({ mimeType: 'image/png', extension: 'png' });
  });

  it('returns null for unknown content', () => {
    const content = Buffer.from('This is plain text, not a document');
    expect(sniffMimeType(content)).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(sniffMimeType(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for content too short for any signature', () => {
    expect(sniffMimeType(Buffer.from([0x25]))).toBeNull();
  });

  it('detects type from content regardless of extension naming', () => {
    // A file named .txt but with PDF content should be detected as PDF
    const pdfContent = makePdfContent();
    const result = sniffMimeType(pdfContent);
    expect(result?.mimeType).toBe('application/pdf');
  });
});

describe('isAllowedMimeType', () => {
  it('allows application/pdf', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true);
  });

  it('allows image/jpeg', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
  });

  it('allows image/png', () => {
    expect(isAllowedMimeType('image/png')).toBe(true);
  });

  it('rejects text/plain', () => {
    expect(isAllowedMimeType('text/plain')).toBe(false);
  });

  it('rejects application/zip', () => {
    expect(isAllowedMimeType('application/zip')).toBe(false);
  });
});

// ─── uploadDocument ─────────────────────────────────────────────

describe('uploadDocument', () => {
  let deps: DocumentServiceDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('creates a document record with correct fields', async () => {
    const content = makePdfContent(2048);
    const expectedDoc = makeDocumentRecord();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getDocumentByCaseAndSha).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createDocument).mockResolvedValueOnce(expectedDoc);

    const result = await uploadDocument('case-001', content, validMetadata, deps);

    expect(result.deduplicated).toBe(false);
    expect(result.document).toEqual(expectedDoc);
    expect(deps.db.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: 'case-001',
        kind: 'payslip',
        status: 'pending',
        original_filename: 'payslip_jan_2023.pdf',
        mime_type: 'application/pdf',
        size_bytes: 2048,
      }),
    );
  });

  it('computes SHA-256 hash from content before persistence', async () => {
    const content = makePdfContent(256);

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getDocumentByCaseAndSha).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createDocument).mockResolvedValueOnce(makeDocumentRecord());

    await uploadDocument('case-001', content, validMetadata, deps);

    // Verify SHA-256 was calculated and passed to createDocument
    const createCall = vi.mocked(deps.db.createDocument).mock.calls[0]![0]!;
    expect(createCall.sha256).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(createCall.sha256)).toBe(true);
  });

  it('determines MIME type from content, not extension', async () => {
    // Metadata says "payslip.pdf" but content is JPEG
    const jpegContent = makeJpegContent();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getDocumentByCaseAndSha).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createDocument).mockResolvedValueOnce(makeDocumentRecord());

    await uploadDocument('case-001', jpegContent, validMetadata, deps);

    expect(deps.db.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        mime_type: 'image/jpeg',
      }),
    );
  });

  it('stores document under {org_id}/{case_id}/{document_id}.{ext}', async () => {
    const content = makePdfContent();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getDocumentByCaseAndSha).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createDocument).mockResolvedValueOnce(makeDocumentRecord());

    await uploadDocument('case-001', content, validMetadata, deps);

    const storagePath = vi.mocked(deps.storage.putObject).mock.calls[0]![0]!;
    expect(storagePath).toMatch(/^org-001\/case-001\/[a-f0-9-]+\.pdf$/);
  });

  it('returns existing document for duplicate upload (same case + SHA-256)', async () => {
    const content = makePdfContent();
    const existingDoc = makeDocumentRecord();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getDocumentByCaseAndSha).mockResolvedValueOnce(existingDoc);

    const result = await uploadDocument('case-001', content, validMetadata, deps);

    expect(result.deduplicated).toBe(true);
    expect(result.document).toEqual(existingDoc);
    // Should NOT upload to storage or create a new record
    expect(deps.storage.putObject).not.toHaveBeenCalled();
    expect(deps.db.createDocument).not.toHaveBeenCalled();
  });

  it('rejects files larger than 10 MB', async () => {
    const oversized = makePdfContent(10 * 1024 * 1024 + 1); // 10 MB + 1 byte

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());

    await expect(
      uploadDocument('case-001', oversized, validMetadata, deps),
    ).rejects.toThrowError(AppError);
    await expect(
      uploadDocument('case-001', oversized, validMetadata, deps),
    ).rejects.toThrow(/exceeds/i);
  });

  it('rejects empty files', async () => {
    const empty = Buffer.alloc(0);

    await expect(
      uploadDocument('case-001', empty, validMetadata, deps),
    ).rejects.toThrowError(AppError);
    await expect(
      uploadDocument('case-001', empty, validMetadata, deps),
    ).rejects.toThrow(/empty/i);
  });

  it('rejects unsupported MIME types', async () => {
    // Content that doesn't match any known signature
    const unknownContent = Buffer.alloc(512);
    unknownContent[0] = 0x00;
    unknownContent[1] = 0x01;
    unknownContent[2] = 0x02;

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());

    await expect(
      uploadDocument('case-001', unknownContent, validMetadata, deps),
    ).rejects.toThrowError(AppError);
  });

  it('rejects upload when case is not in awaiting_documents status', async () => {
    const content = makePdfContent();

    vi.mocked(deps.db.getCaseById).mockResolvedValue(
      makeCaseRecord({ status: 'draft' }),
    );

    await expect(
      uploadDocument('case-001', content, validMetadata, deps),
    ).rejects.toThrowError(AppError);
    await expect(
      uploadDocument('case-001', content, validMetadata, deps),
    ).rejects.toThrow(/awaiting_documents/i);
  });

  it('rejects upload when case is withdrawn (withdrawn candidates cannot submit documents)', async () => {
    const content = makePdfContent();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(
      makeCaseRecord({ status: 'withdrawn' }),
    );

    await expect(
      uploadDocument('case-001', content, validMetadata, deps),
    ).rejects.toThrowError(AppError);
  });

  it('rejects invalid metadata schema', async () => {
    const content = makePdfContent();

    await expect(
      uploadDocument('case-001', content, { kind: 'invalid_kind' }, deps),
    ).rejects.toThrowError(AppError);
  });

  it('throws 404 for non-existent case', async () => {
    const content = makePdfContent();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(null);

    await expect(
      uploadDocument('case-missing', content, validMetadata, deps),
    ).rejects.toThrowError(AppError);
    await expect(
      uploadDocument('case-missing', content, validMetadata, deps),
    ).rejects.toThrow(/not found/i);
  });

  it('accepts Form 16 document kind', async () => {
    const content = makePdfContent();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getDocumentByCaseAndSha).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createDocument).mockResolvedValueOnce(makeDocumentRecord({ kind: 'form_16' }));

    const result = await uploadDocument(
      'case-001',
      content,
      { kind: 'form_16', original_filename: 'form16_2023.pdf' },
      deps,
    );

    expect(result.document.kind).toBe('form_16');
  });

  it('accepts exactly 10 MB files (boundary test)', async () => {
    const maxSize = makePdfContent(10 * 1024 * 1024); // exactly 10 MB

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getDocumentByCaseAndSha).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createDocument).mockResolvedValueOnce(makeDocumentRecord());

    const result = await uploadDocument('case-001', maxSize, validMetadata, deps);

    expect(result.deduplicated).toBe(false);
  });
});
