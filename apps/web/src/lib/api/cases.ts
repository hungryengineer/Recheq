import type { CaseRecord, CaseSummary, FindingRecord } from '@tieout/schema';
import { getCase, listCases } from '@tieout/api/web';
import { getCaseDeps, DEV_ORG_ID } from './db';

export async function getCases(): Promise<CaseSummary[]> {
  return await listCases(DEV_ORG_ID, getCaseDeps());
}

export type CaseDetailsResult =
  | { found: true; caseRecord: CaseRecord; findings: FindingRecord[]; notAssessed: string[] }
  | { found: false };

export async function getCaseDetails(id: string): Promise<CaseDetailsResult> {
  try {
    const caseRecord = await getCase(id, DEV_ORG_ID, getCaseDeps());

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
      (err as { statusCode: number }).statusCode === 404;

    if (isNotFound) {
      return { found: false };
    }

    throw err;
  }
}
