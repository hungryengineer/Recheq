import { eq } from 'drizzle-orm';
import { CaseStatus, Verdict, type CaseRecord } from '@recheq/schema';
import { cases } from './schema/cases.js';
import type { Database } from './client.js';

/** Maps a DB row to the @recheq/schema CaseRecord contract (numeric/timestamp -> primitives). */
export function toCaseRecord(row: (typeof cases)['$inferSelect']): CaseRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    created_by: row.created_by,
    employer_name: row.employer_name,
    candidate_name: row.candidate_name,
    candidate_email: row.candidate_email,
    title: row.title,
    claimed_ctc: Number(row.claimed_ctc),
    employment_start: row.employment_start,
    employment_end: row.employment_end,
    uan: row.uan,
    status: CaseStatus.parse(row.status),
    verdict: row.verdict !== null ? Verdict.parse(row.verdict) : null,
    risk_score: row.risk_score,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/** Loads a single case record by id, or null when no such row exists. */
export async function getCaseRecordById(db: Database, caseId: string): Promise<CaseRecord | null> {
  const rows = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  return rows[0] ? toCaseRecord(rows[0]) : null;
}
