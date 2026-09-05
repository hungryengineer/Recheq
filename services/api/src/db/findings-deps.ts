import { eq } from 'drizzle-orm';
import { FindingSeverity, FindingStatus, type FindingRecord } from '@recheq/schema';
import { findings } from './schema/findings.js';
import type { Database } from './client.js';

type FindingRow = typeof findings.$inferSelect;

/**
 * Maps a findings table row to the @recheq/schema FindingRecord contract.
 * Drizzle returns uuid[] as arrays, timestamps as Date objects, and enum-ish
 * varchar columns as strings, so they are normalized here at the boundary.
 */
function toFindingRecord(row: FindingRow): FindingRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    rule_id: row.rule_id,
    severity: FindingSeverity.parse(row.severity),
    status: FindingStatus.parse(row.status),
    title: row.title,
    explanation: row.explanation,
    expected: row.expected,
    observed: row.observed,
    source_document_ids: row.source_document_ids ?? [],
    dispute_reason: row.dispute_reason ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Reads all findings for a case, ordered by severity (high → low) then created
 * time. Used to render the discrepancy ledger for a case details view.
 */
export async function getFindingsByCase(db: Database, caseId: string): Promise<FindingRecord[]> {
  const rows = await db.select().from(findings).where(eq(findings.case_id, caseId));
  const severityRank: Record<FindingSeverity, number> = { high: 0, medium: 1, low: 2 };
  return rows
    .map(toFindingRecord)
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.created_at.localeCompare(b.created_at),
    );
}
