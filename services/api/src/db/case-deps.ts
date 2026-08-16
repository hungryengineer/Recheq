import { and, desc, eq } from 'drizzle-orm';
import type { CaseSummary, CaseStatus, Verdict } from '@tieout/schema';
import { cases } from './schema/cases.js';
import { toCaseRecord } from './case-queries.js';
import type { Database } from './client.js';
import type { CaseServiceDeps } from '../services/cases/case-service.js';

type CaseRow = typeof cases.$inferSelect;

function toCaseSummary(row: CaseRow): CaseSummary {
  return {
    id: row.id,
    employer_name: row.employer_name,
    candidate_name: row.candidate_name,
    title: row.title,
    status: row.status as CaseStatus,
    verdict: row.verdict as Verdict | null,
    risk_score: row.risk_score,
    created_at: row.created_at.toISOString(),
  };
}

/**
 * Production adapter that backs the case service with the real database.
 * Drizzle numeric columns come back as strings and timestamps as Date objects,
 * so rows are mapped to the @tieout/schema contracts here at the boundary.
 */
export function createCaseDeps(db: Database): CaseServiceDeps {
  return {
    db: {
      async createCase(input) {
        const [row] = await db
          .insert(cases)
          .values({
            org_id: input.org_id,
            created_by: input.created_by,
            employer_name: input.employer_name,
            candidate_name: input.candidate_name,
            title: input.title,
            claimed_ctc: String(input.claimed_ctc),
            employment_start: input.employment_start,
            employment_end: input.employment_end,
            uan: input.uan,
            status: input.status,
            verdict: input.verdict,
            risk_score: input.risk_score,
          })
          .returning();
        if (!row) {
          throw new Error('createCase failed: no row returned');
        }
        return toCaseRecord(row);
      },
      async listCasesByOrg(orgId) {
        const rows = await db
          .select()
          .from(cases)
          .where(eq(cases.org_id, orgId))
          .orderBy(desc(cases.created_at));
        return rows.map(toCaseSummary);
      },
      async getCaseByIdAndOrg(caseId, orgId) {
        const rows = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, caseId), eq(cases.org_id, orgId)))
          .limit(1);
        return rows[0] ? toCaseRecord(rows[0]) : null;
      },
    },
  };
}
