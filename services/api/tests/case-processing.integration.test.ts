import { describe, expect, it, vi } from 'vitest';
import { processCase, type CaseProcessingDeps } from '../src/workflows/case-processing.js';

vi.mock('../src/extraction/extraction-service.js', () => ({
  createExtraction: vi.fn().mockResolvedValue('ext-1'),
  updateExtractionSuccess: vi.fn().mockResolvedValue(undefined),
  updateExtractionFailure: vi.fn().mockResolvedValue(undefined),
}));

describe('Case Processing Orchestration', () => {
  it('processes a case end-to-end and replaces findings safely', async () => {
    const _deps: CaseProcessingDeps = {
      db: {
        getCaseById: vi.fn().mockResolvedValue({ id: 'case-1', uan: '1234', status: 'processing' }),
        getConsentByCaseId: vi.fn().mockResolvedValue({ id: 'consent-1' }),
        getDocumentsForCase: vi.fn().mockResolvedValue([{ id: 'doc-1', kind: 'payslip' }]),
        getSuccessfulExtractions: vi.fn().mockResolvedValue([]),
        getCompletedEpfoRecords: vi
          .fn()
          .mockResolvedValue([{ employment_history: { establishment: { establishmentId: 'A' } } }]),
        getCompletedForensics: vi.fn().mockResolvedValue([]),
        createPendingRecord: vi.fn().mockResolvedValue('epfo-1'),
        updateRecordSuccess: vi.fn().mockResolvedValue(undefined),
        updateRecordFailure: vi.fn().mockResolvedValue(undefined),
        getDocumentContent: vi
          .fn()
          .mockResolvedValue({ content: 'base64', mimeType: 'application/pdf' }),
        replaceFindings: vi.fn().mockResolvedValue(undefined),
        updateCaseStatusAndVerdict: vi.fn().mockResolvedValue(undefined),
        transaction: vi.fn(async (cb) => cb({})),
      } as unknown as CaseProcessingDeps['db'],
      audit: {
        appendEvent: vi.fn().mockResolvedValue({}),
      } as unknown as CaseProcessingDeps['audit'],
      epfoProvider: {
        fetchEmploymentHistory: vi
          .fn()
          .mockResolvedValue({ establishment: { establishmentId: 'A' } }),
      } as unknown as CaseProcessingDeps['epfoProvider'],
      extractor: {
        extractPayslip: vi.fn().mockResolvedValue({ data: {}, usage: {} }),
        extractForm16: vi.fn().mockResolvedValue({ data: {}, usage: {} }),
      } as unknown as CaseProcessingDeps['extractor'],
    };

    const processPromise = processCase('case-1', false, _deps);
    await expect(processPromise).resolves.toBeUndefined();

    // Verify evidence assembly and rules were run (findings saved and verdict calculated)
    // Verify evidence assembly and rules were run (findings saved and verdict calculated)
    expect(_deps.db.replaceFindings).toHaveBeenCalledWith(
      expect.anything(),
      'case-1',
      expect.any(Array),
    );
    expect(_deps.db.updateCaseStatusAndVerdict).toHaveBeenCalledWith(
      expect.anything(),
      'case-1',
      'complete',
      expect.any(String),
      expect.any(Number),
    );
    expect(_deps.audit.appendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'verdict_calculated',
        case_id: 'case-1',
      }),
    );
  });

  it('aborts on withdrawn cases', async () => {
    const deps = {
      db: {
        getCaseById: vi.fn().mockResolvedValue({ id: 'case-1', status: 'withdrawn' }),
      },
    } as unknown as CaseProcessingDeps;

    await expect(processCase('case-1', false, deps)).rejects.toThrow(
      'Cannot process a withdrawn case.',
    );
  });
});
