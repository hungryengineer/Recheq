import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processCase, updateExtractionSuccess, CaseProcessingDeps } from '../src/workflows/case-processing.js';

describe('Case Processing', () => {
  let mockDb: any;
  let mockExtractor: any;
  let deps: CaseProcessingDeps;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'doc-1',
                case_id: 'case-1',
                document_type: 'payslip',
                raw_content: 'payslip data',
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    mockExtractor = {
      extractPayslip: vi.fn().mockResolvedValue({ data: { basic: 50000 }, usage: { tokens: 100 } }),
      extractForm16: vi.fn().mockResolvedValue({ data: { tds: 5000 }, usage: { tokens: 150 } }),
    };

    deps = {
      db: mockDb,
      extractor: mockExtractor,
    };
  });

  it('should extract payslip with correct methods', async () => {
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValueOnce([
              {
                id: 'case-1',
                document_type: 'payslip',
                raw_content: 'payslip data',
              },
            ])
            .mockResolvedValueOnce([
              {
                id: 'doc-1',
                case_id: 'case-1',
                document_type: 'payslip',
                raw_content: 'payslip data',
              },
            ]),
        }),
      }),
    }));

    await processCase(deps, 'case-1');

    expect(mockExtractor.extractPayslip).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc-1', content: 'payslip data' }),
    );
  });

  it('should call updateExtractionSuccess on successful extraction', async () => {
    const setSpy = vi.fn().mockResolvedValue({});
    mockDb.update.mockReturnValue({
      set: setSpy,
    });

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValueOnce([{ id: 'case-1', document_type: 'payslip', raw_content: 'payslip data' }])
            .mockResolvedValueOnce([{ id: 'doc-1', case_id: 'case-1', document_type: 'payslip', raw_content: 'payslip data' }]),
        }),
      }),
    }));

    await processCase(deps, 'case-1');

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  it('should handle extraction errors gracefully', async () => {
    mockExtractor.extractPayslip.mockRejectedValueOnce(new Error('Extraction failed'));

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValueOnce([{ id: 'case-1', document_type: 'payslip', raw_content: 'payslip data' }])
            .mockResolvedValueOnce([{ id: 'doc-1', case_id: 'case-1', document_type: 'payslip', raw_content: 'payslip data' }]),
        }),
      }),
    }));

    await processCase(deps, 'case-1');

    // Should not throw - error is caught and logged
    expect(mockDb.update).toHaveBeenCalled();
  });
});
