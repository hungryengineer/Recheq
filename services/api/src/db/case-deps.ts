import { and, desc, eq } from 'drizzle-orm';
import { CaseStatus, Verdict, type CaseSummary } from '@tieout/schema';
import { cases } from './schema/cases.js';
import { toCaseRecord } from './case-queries.js';
import type { Database } from './client.js';
import type { CaseServiceDeps } from '../services/cases/case-service.js';

export type TransactionHandle = Parameters<Parameters<Database['transaction']>[0]>[0];

type CaseRow = typeof cases.$inferSelect;

/** Maps a DB case row to the @tieout/schema CaseSummary contract. */
function toCaseSummary(row: CaseRow): CaseSummary {
  return {
    id: row.id,
    employer_name: row.employer_name,
    candidate_name: row.candidate_name,
    candidate_email: row.candidate_email,
    title: row.title,
    status: CaseStatus.parse(row.status),
    verdict: row.verdict !== null ? Verdict.parse(row.verdict) : null,
    risk_score: row.risk_score,
    created_at: row.created_at.toISOString(),
  };
}

import { AuditService } from '../audit/audit-service.js';
import { DbAuditRepository } from '../audit/db-audit-repository.js';

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
            candidate_email: input.candidate_email,
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
      async findExistingCase(orgId, candidateName, candidateEmail, employerName) {
        const rows = await db
          .select()
          .from(cases)
          .where(
            and(
              eq(cases.org_id, orgId),
              eq(cases.candidate_email, candidateEmail),
              eq(cases.candidate_name, candidateName),
              eq(cases.employer_name, employerName),
            ),
          )
          .orderBy(desc(cases.created_at));

        // Avoid terminal states to prevent rejecting valid re-verifications of old cases
        const active = rows.find((r) => r.status !== 'complete' && r.status !== 'withdrawn');
        return active ? toCaseRecord(active) : null;
      },
      async getCaseByIdAndOrg(caseId, orgId, tx) {
        const queryBuilder = tx ?? db;
        const query = queryBuilder
          .select()
          .from(cases)
          .where(and(eq(cases.id, caseId), eq(cases.org_id, orgId)))
          .limit(1);

        if (tx) {
          // Lock row during transaction to prevent concurrent updates
          query.for('update');
        }

        const rows = await query;
        return rows[0] ? toCaseRecord(rows[0]) : null;
      },
      async updateCaseDetails(tx, caseId, input) {
        const queryBuilder = tx ?? db;
        await queryBuilder
          .update(cases)
          .set({
            ...input,
            claimed_ctc: input.claimed_ctc !== undefined ? String(input.claimed_ctc) : undefined,
            updated_at: new Date(),
          })
          .where(eq(cases.id, caseId));
      },
      async transaction(cb) {
        return await db.transaction(async (tx) => cb(tx));
      },
    },
    audit: {
      async appendEvent(tx, input) {
        const auditService = new AuditService(new DbAuditRepository(db));
        return await auditService.appendEvent(tx, input);
      },
    },
  };
}
