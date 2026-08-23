import type { CaseRecord, CaseSummary, FindingRecord } from '@tieout/schema';
import { getCase, listCases, getFindingsByCase } from '@tieout/api/web';
import { getCaseDeps, getDevOrgId, getDb } from './db';

import { cookies } from 'next/headers';
import { verifyToken } from '@tieout/api/src/security/jwt.js';

async function getAuthOrgId(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.orgId) {
      return payload.orgId;
    }
  }
  // Fallback to devOrgId for local development if not authenticated (or throw error in prod)
  return getDevOrgId();
}

export async function getCases(): Promise<CaseSummary[]> {
  const orgId = await getAuthOrgId();
  return await listCases(orgId, getCaseDeps());
}

export type CaseDetailsResult =
  | { found: true; caseRecord: CaseRecord; findings: FindingRecord[]; notAssessed: string[] }
  | { found: false };

export async function getCaseDetails(id: string): Promise<CaseDetailsResult> {
  try {
    const orgId = await getAuthOrgId();
    const caseRecord = await getCase(id, orgId, getCaseDeps());

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
