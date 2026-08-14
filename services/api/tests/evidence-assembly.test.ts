import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assembleEvidence, type EvidenceServiceDeps } from '../src/evidence/evidence-service.js';

describe('Evidence Assembly Service with Dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assembles context with all data missing', async () => {
    const dbMock = {
      getDocumentsForCase: vi.fn().mockResolvedValue([]),
      getSuccessfulExtractions: vi.fn().mockResolvedValue([]),
      getCompletedEpfoRecords: vi.fn().mockResolvedValue([]),
    };

    const deps: EvidenceServiceDeps = { db: dbMock };

    const context = await assembleEvidence(deps, 'case-123');

    expect(context.assembly.origins).toEqual([]);
    expect(context.assembly.has_payslip).toBe(false);
    expect(context.assembly.has_form16).toBe(false);
    expect(context.assembly.has_epfo).toBe(false);
    expect(context.payslip).toBeNull();
    expect(context.form16).toBeNull();
    expect(context.epfoHistory).toBeNull();
  });

  it('picks the newest document that has a successful extraction', async () => {
    const oldDate = new Date('2023-01-01');
    const newDate = new Date('2023-02-01');

    const dbMock = {
      getDocumentsForCase: vi.fn().mockResolvedValue([
        { id: 'doc-old-payslip', kind: 'payslip', created_at: oldDate },
        { id: 'doc-new-payslip', kind: 'payslip', created_at: newDate },
        { id: 'doc-form16', kind: 'form_16', created_at: newDate },
      ]),
      getSuccessfulExtractions: vi.fn().mockResolvedValue([
        // Both payslips have extractions, but doc-new-payslip is newer
        { document_id: 'doc-old-payslip', extracted_data: { basic: 1000 } },
        { document_id: 'doc-new-payslip', extracted_data: { basic: 5000 } },
        // form16 has extraction
        { document_id: 'doc-form16', extracted_data: { tax: 200 } },
      ]),
      getCompletedEpfoRecords: vi.fn().mockResolvedValue([]),
    };

    const deps: EvidenceServiceDeps = { db: dbMock };

    const context = await assembleEvidence(deps, 'case-123');

    expect(context.assembly.origins).toContain('payslip');
    expect(context.assembly.origins).toContain('form_16');
    expect(context.assembly.has_payslip).toBe(true);
    expect(context.assembly.has_form16).toBe(true);
    expect(context.payslip).toEqual({ basic: 5000 }); // Picked the newer one
    expect(context.form16).toEqual({ tax: 200 });
  });

  it('ignores newer documents if they failed extraction (no extraction record)', async () => {
    const oldDate = new Date('2023-01-01');
    const newDate = new Date('2023-02-01');

    const dbMock = {
      getDocumentsForCase: vi.fn().mockResolvedValue([
        { id: 'doc-old-payslip', kind: 'payslip', created_at: oldDate },
        { id: 'doc-new-payslip', kind: 'payslip', created_at: newDate },
      ]),
      getSuccessfulExtractions: vi.fn().mockResolvedValue([
        // Only the old payslip has a successful extraction
        { document_id: 'doc-old-payslip', extracted_data: { basic: 1000 } },
      ]),
      getCompletedEpfoRecords: vi.fn().mockResolvedValue([]),
    };

    const deps: EvidenceServiceDeps = { db: dbMock };

    const context = await assembleEvidence(deps, 'case-123');

    expect(context.assembly.has_payslip).toBe(true);
    expect(context.payslip).toEqual({ basic: 1000 }); // Picked the older one because the newer one failed
  });
});
