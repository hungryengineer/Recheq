import { eq, desc, and, lt } from 'drizzle-orm';
import { schema } from '../../../db/client.js';
import type { Database } from '../../../db/client.js';

// ─── v1 Cases API (API-key authenticated) ───────────────────────
// Programmatic read surface for ATS integration. Authenticated via a
// `req_live_` bearer key (see security/api-key-auth.ts). Returns the same
// case summary shape as the staff routes but is reachable without a user
// session, which is what makes the programmatic path real.

export interface V1ListCasesQuery {
  orgId: string;
  limit?: number;
  status?: string;
  cursor?: string;
}

export async function listCasesV1Handler(
  req: { auth: { orgId: string }; query?: Record<string, string | undefined> },
  deps: { db: Database },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any }> {
  const orgId = req.auth.orgId;
  const limit = Math.min(Number(req.query?.limit ?? 50), 200);
  const status = req.query?.status;
  const cursor = req.query?.cursor;

  const conditions = [eq(schema.cases.org_id, orgId)];
  if (status) conditions.push(eq(schema.cases.status, status));
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (Number.isNaN(cursorDate.getTime())) {
      return { status: 400, body: { error: { code: 'INVALID_CURSOR', message: 'Invalid cursor' } } };
    }
    conditions.push(lt(schema.cases.created_at, cursorDate));
  }

  const rows = await deps.db
    .select({
      id: schema.cases.id,
      title: schema.cases.title,
      candidate_name: schema.cases.candidate_name,
      status: schema.cases.status,
      verdict: schema.cases.verdict,
      risk_score: schema.cases.risk_score,
      created_at: schema.cases.created_at,
    })
    .from(schema.cases)
    .where(and(...conditions))
    .orderBy(desc(schema.cases.created_at))
    .limit(limit);

  const cases = rows.map((r) => ({
    id: r.id,
    title: r.title,
    candidateName: r.candidate_name,
    status: r.status,
    verdict: r.verdict ?? null,
    riskScore: r.risk_score ?? null,
    createdAt: r.created_at.toISOString(),
  }));

  const last = cases.length > 0 ? cases[cases.length - 1] : undefined;
  return {
    status: 200,
    body: {
      cases,
      nextCursor: last ? last.createdAt : null,
    },
  };
}