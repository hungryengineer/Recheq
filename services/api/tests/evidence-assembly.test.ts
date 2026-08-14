import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assembleEvidence } from '../src/evidence/evidence-service.js';
import type { Database } from '../src/db/client.js';

describe('Evidence Assembly Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assembles context with all data missing', async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn(() => ({ where: whereMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));
    const dbMock = { select: selectMock } as unknown as Database;

    const context = await assembleEvidence(dbMock, 'case-123');

    expect(context.assembly.origins).toEqual([]);
    expect(context.assembly.has_payslip).toBe(false);
    expect(context.assembly.has_form16).toBe(false);
    expect(context.assembly.has_epfo).toBe(false);
    expect(context.payslip).toBeNull();
    expect(context.form16).toBeNull();
    expect(context.epfoHistory).toBeNull();
  });

  it('assembles context with payslip data only', async () => {
    const whereMock = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'doc-1', kind: 'payslip' }]) // documents
      .mockResolvedValueOnce([
        { document_id: 'doc-1', status: 'completed', extracted_data: { basic: 5000 } },
      ]) // extractions
      .mockResolvedValueOnce([]); // epfo

    const fromMock = vi.fn(() => ({ where: whereMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));
    const dbMock = { select: selectMock } as unknown as Database;

    const context = await assembleEvidence(dbMock, 'case-123');

    expect(context.assembly.origins).toContain('payslip');
    expect(context.assembly.has_payslip).toBe(true);
    expect(context.assembly.has_form16).toBe(false);
    expect(context.payslip).toEqual({ basic: 5000 });
  });
});
