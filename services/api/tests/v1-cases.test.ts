import { describe, it, expect, vi } from 'vitest';
import { listCasesV1Handler } from '../src/routes/v1/cases/list.js';

interface MockCaseRow {
  id: string;
  title: string;
  candidate_name: string;
  status: string;
  verdict: string | null;
  risk_score: number | null;
  created_at: Date;
}

function mockQuery(rows: MockCaseRow[]) {
  const internal: MockCaseRow[] = rows;
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(internal)),
  };
  return chain;
}

describe('listCasesV1Handler', () => {
  it('rejects an invalid cursor with 400', async () => {
    const db = mockQuery([]);
    const result = await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: { cursor: 'not-a-date' } },
      { db: db as never },
    );
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { code: 'INVALID_CURSOR' } });
  });

  it('returns org-scoped cases with nextCursor', async () => {
    const rows: MockCaseRow[] = [
      {
        id: 'case-1',
        title: 'Background check',
        candidate_name: 'Jane Doe',
        status: 'complete',
        verdict: 'verified',
        risk_score: 12,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    ];
    const db = mockQuery(rows);
    const result = await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: {} },
      { db: db as never },
    );

    expect(result.status).toBe(200);
    expect(result.body.cases).toEqual([
      {
        id: 'case-1',
        title: 'Background check',
        candidateName: 'Jane Doe',
        status: 'complete',
        verdict: 'verified',
        riskScore: 12,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(result.body.nextCursor).toBe('2026-01-01T00:00:00.000Z');
  });

  it('clamps limit to 200', async () => {
    const db = mockQuery([]);
    await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: { limit: '5000' } },
      { db: db as never },
    );
    expect(db.limit).toHaveBeenCalledWith(200);
  });

  it('filters by status when provided', async () => {
    const db = mockQuery([]);
    await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: { status: 'complete' } },
      { db: db as never },
    );
    expect(db.where).toHaveBeenCalled();
  });

  it('returns empty list with null cursor for no rows', async () => {
    const db = mockQuery([]);
    const result = await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: {} },
      { db: db as never },
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ cases: [], nextCursor: null });
  });
});
