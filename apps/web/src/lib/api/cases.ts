import type { CaseRecord, CaseSummary, FindingRecord } from '@tieout/schema';
import { getCase, listCases } from '@tieout/api/web';
import { getCaseDeps, DEV_ORG_ID } from './db';

// Until session/authentication wiring is available, case reads use the
// explicitly configured org identity (DEV_ORG_ID/DEV_USER_ID). requireDevId in
// db.ts fails closed in production when those are not set, so reads only
// proceed when a valid org identity is configured.
function devOrgId(): string {
  return DEV_ORG_ID;
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

    return {
      found: true,
      caseRecord,
      // TODO: populate findings from the findings table once FindingsRepository is wired.
      // See services/api/src/db/findings-deps.ts (to be created as part of BE-15).
      findings: [],
      notAssessed: [],
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
