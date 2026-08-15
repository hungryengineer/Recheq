import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CaseProcessingDeps } from '../src/workflows/case-processing.js';
import { processCase } from '../src/workflows/case-processing.js';

describe('Case Processing', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockExtractor: {
    extractPayslip: ReturnType<typeof vi.fn>;
    extractForm16: ReturnType<typeof vi.fn>;
  };
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
      extractPayslip: vi
        .fn()
        .mockResolvedValue({ data: { basic: 50000 }, usage: { tokens: 100 } }),
      extractForm16: vi
        .fn()
        .mockResolvedValue({ data: { tds: 5000 }, usage: { tokens: 150 } }),
    };

    deps = {
      db: mockDb as unknown as CaseProcessingDeps['db'],
      extractor: mockExtractor,
    };
  });

  it('should extract payslip with correct methods', async () => {
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

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' }),
    );
  });

  it('should handle extraction errors gracefully', async () => {
    mockExtractor.extractPayslip.mockRejectedValueOnce(
      new Error('Extraction failed'),
    );

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

    expect(mockDb.update).toHaveBeenCalled();
  });
});
