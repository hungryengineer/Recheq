import { eq, desc, and, or, lt } from 'drizzle-orm';
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

export type V1CasesListResult =
  | { status: 200; body: { cases: V1CaseSummaryDto[]; nextCursor: string | null } }
  | { status: 400; body: { error: { code: 'INVALID_CURSOR' | 'INVALID_LIMIT'; message: string } } };

interface V1CaseSummaryDto {
  id: string;
  title: string;
  candidateName: string;
  status: string;
  verdict: string | null;
  riskScore: number | null;
  createdAt: string;
}

const MAX_LIMIT = 200;

export async function listCasesV1Handler(
  req: { auth: { orgId: string }; query?: Record<string, string | undefined> },
  deps: { db: Database },
): Promise<V1CasesListResult> {
  const orgId = req.auth.orgId;
  const rawLimit = req.query?.limit;

  let limit = 50;
  if (rawLimit !== undefined) {
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return {
        status: 400,
        body: { error: { code: 'INVALID_LIMIT', message: 'limit must be a positive integer' } },
      };
    }
    limit = Math.min(parsedLimit, MAX_LIMIT);
  }

  const status = req.query?.status;

  const conditions = [eq(schema.cases.org_id, orgId)];
  if (status) conditions.push(eq(schema.cases.status, status));

  const cursor = req.query?.cursor;
  // Stable pagination: advance by (created_at, id) so rows created in the same
  // millisecond are never skipped or duplicated across pages.
  if (cursor) {
    const [cursorDate, cursorId] = cursor.split('|');
    const parsedCursorDate = new Date(cursorDate ?? '');
    if (Number.isNaN(parsedCursorDate.getTime())) {
      return {
        status: 400,
        body: { error: { code: 'INVALID_CURSOR', message: 'Invalid cursor' } },
      };
    }
    if (cursorId) {
      const cursorCondition = or(
        lt(schema.cases.created_at, parsedCursorDate),
        and(eq(schema.cases.created_at, parsedCursorDate), lt(schema.cases.id, cursorId)),
      );
      if (cursorCondition) conditions.push(cursorCondition);
    } else {
      conditions.push(lt(schema.cases.created_at, parsedCursorDate));
    }
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
    .orderBy(desc(schema.cases.created_at), desc(schema.cases.id))
    .limit(limit);

  const cases: V1CaseSummaryDto[] = rows.map((r) => ({
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
      nextCursor: last ? `${last.createdAt}|${last.id}` : null,
    },
  };
}
