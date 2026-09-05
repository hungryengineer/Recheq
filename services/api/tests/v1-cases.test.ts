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
    if (result.status !== 200) return;
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
    expect(result.body.nextCursor).toBe('2026-01-01T00:00:00.000Z|case-1');
  });

  it('rejects a non-integer limit with 400', async () => {
    const db = mockQuery([]);
    const result = await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: { limit: 'abc' } },
      { db: db as never },
    );
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { code: 'INVALID_LIMIT' } });

    const zero = await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: { limit: '0' } },
      { db: db as never },
    );
    expect(zero.status).toBe(400);
    expect(zero.body).toMatchObject({ error: { code: 'INVALID_LIMIT' } });
  });

  it('uses a stable (created_at, id) cursor for pagination', async () => {
    const db = mockQuery([]);
    await listCasesV1Handler(
      { auth: { orgId: 'org-1' }, query: { cursor: '2026-01-01T00:00:00.000Z|case-3' } },
      { db: db as never },
    );
    expect(db.where).toHaveBeenCalled();
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

import { createCaseV1Handler } from '../src/routes/v1/cases/create.js';
import * as CaseService from '../src/services/cases/case-service.js';

describe('createCaseV1Handler', () => {
  it('rejects creation if no user exists in org', async () => {
    const db = mockQuery([]); // Returns empty array for user lookup
    const result = await createCaseV1Handler(
      {
        body: {},
        context: {} as any,
        auth: { orgId: 'org-1', apiKeyId: 'key-1', name: 'Test Key' },
      },
      { db: db as never } as any,
    );

    expect(result.status).toBe(500); // Because it throws an Error, which toErrorResponse catches as 500
    expect(result.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });

  it('delegates to createCase with found user ID and returns 201', async () => {
    // Mock user lookup
    const db = mockQuery([{ id: 'user-1' } as any]);
    
    // Mock createCase
    const createCaseSpy = vi.spyOn(CaseService, 'createCase').mockResolvedValue({
      id: 'new-case-1',
      status: 'awaiting_consent',
      created_at: '2026-01-01T00:00:00Z',
    } as any);

    const body = {
      candidate_name: 'John',
      candidate_email: 'john@example.com',
      employer_name: 'Acme',
      title: 'Dev',
      claimed_ctc: 1000,
      employment_start: '2025-01-01',
      employment_end: '2025-12-31'
    };

    const result = await createCaseV1Handler(
      {
        body,
        context: {} as any,
        auth: { orgId: 'org-1', apiKeyId: 'key-1', name: 'Test Key' },
      },
      { db: db as never } as any,
    );

    expect(createCaseSpy).toHaveBeenCalledWith(body, 'user-1', 'org-1', expect.anything());
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      id: 'new-case-1',
      status: 'awaiting_consent',
      candidate_link: 'https://recheq.com/c/pending',
      created_at: '2026-01-01T00:00:00Z'
    });
    
    createCaseSpy.mockRestore();
  });
});

