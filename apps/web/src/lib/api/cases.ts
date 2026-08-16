import type { CaseRecord, CaseSummary, FindingRecord } from '@tieout/schema';
import { getCase, listCases, getFindingsByCase } from '@tieout/api/web';
import { getCaseDeps, getDevOrgId, getDb } from './db';

// Until session/authentication wiring is available, case reads use the
// explicitly configured org identity (getDevOrgId/getDevUserId). requireDevId in
// db.ts fails closed in production when those are not set, so reads only
// proceed when a valid org identity is configured.
function devOrgId(): string {
  return getDevOrgId();
}

export async function getCases(): Promise<CaseSummary[]> {
  return await listCases(devOrgId(), getCaseDeps());
}

export type CaseDetailsResult =
  | { found: true; caseRecord: CaseRecord; findings: FindingRecord[]; notAssessed: string[] }
  | { found: false };

export async function getCaseDetails(id: string): Promise<CaseDetailsResult> {
  try {
    const caseRecord = await getCase(id, devOrgId(), getCaseDeps());

    // Load findings from the findings table so the discrepancy ledger is
    // populated for seeded demo cases (BE-15).
    const allFindings = await getFindingsByCase(getDb(), id);
    const findings = allFindings.filter((f) => f.status !== 'not_assessed');
    const notAssessed = allFindings
      .filter((f) => f.status === 'not_assessed')
      .map((f) => f.rule_id);

    return {
      found: true,
      caseRecord,
      findings,
      notAssessed,
    };
  } catch (err: unknown) {
    // Map not-found / foreign-org errors to a clean not-found result.
    // Propagate unexpected infrastructure errors so they surface correctly.
    const isNotFound =
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      typeof (err as { statusCode: unknown }).statusCode === 'number' &&
      (err as { statusCode: number }).statusCode === 404;

    if (isNotFound) {
      return { found: false };
    }

    throw err;
  }
}
