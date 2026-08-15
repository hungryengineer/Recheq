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
  let mockGetContent: ReturnType<typeof vi.fn>;
  let deps: CaseProcessingDeps;

  const CASE_ROW = { id: 'case-1' };
  const DOC_ROW = {
    id: 'doc-1',
    case_id: 'case-1',
    kind: 'payslip',
    storage_path: 'org/case-1/doc-1.txt',
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation((_cond) =>
            Promise.resolve({
              limit: vi.fn().mockResolvedValueOnce([CASE_ROW]),
            }),
          ),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    mockGetContent = vi.fn().mockResolvedValue('payslip data');

    mockExtractor = {
      extractPayslip: vi.fn().mockResolvedValue({ data: { basic: 50000 }, usage: { tokens: 100 } }),
      extractForm16: vi.fn().mockResolvedValue({ data: { tds: 5000 }, usage: { tokens: 150 } }),
    };

    deps = {
      db: mockDb as unknown as CaseProcessingDeps['db'],
      extractor: mockExtractor,
      getContent: mockGetContent,
    };
  });

  it('should extract payslip with correct methods', async () => {
    let call = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          call++;
          if (call === 1) {
            return { limit: vi.fn().mockResolvedValueOnce([CASE_ROW]) };
          }
          return Promise.resolve([DOC_ROW]);
        }),
      }),
    }));

    await processCase(deps, 'case-1');

    expect(mockGetContent).toHaveBeenCalledWith('doc-1', DOC_ROW.storage_path);
    expect(mockExtractor.extractPayslip).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc-1', content: 'payslip data' }),
    );
  });

  it('should call updateExtractionSuccess on successful extraction', async () => {
    const setSpy = vi.fn().mockResolvedValue({});
    mockDb.update.mockReturnValue({
      set: setSpy,
    });

    let call = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          call++;
          if (call === 1) {
            return { limit: vi.fn().mockResolvedValueOnce([CASE_ROW]) };
          }
          return Promise.resolve([DOC_ROW]);
        }),
      }),
    }));

    await processCase(deps, 'case-1');

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('should handle extraction errors gracefully', async () => {
    mockExtractor.extractPayslip.mockRejectedValueOnce(new Error('Extraction failed'));

    let call = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          call++;
          if (call === 1) {
            return { limit: vi.fn().mockResolvedValueOnce([CASE_ROW]) };
          }
          return Promise.resolve([DOC_ROW]);
        }),
      }),
    }));

    await processCase(deps, 'case-1');

    expect(mockDb.update).toHaveBeenCalled();
  });
});
