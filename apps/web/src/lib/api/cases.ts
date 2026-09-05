import type { CaseRecord, CaseSummary, FindingRecord } from '@recheq/schema';
import { getCase, listCases, getFindingsByCase } from '@recheq/api/web';
import { getCaseDeps, getDevOrgId, getDb } from './db';
import { listDocumentKindsByCase } from '@recheq/api/web';
import { schema } from '@recheq/api/src/db/client.js';
import { eq } from 'drizzle-orm';

import { cookies } from 'next/headers';
import { verifyToken } from '@recheq/api/src/security/jwt.js';

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
  | {
      found: true;
      caseRecord: CaseRecord;
      findings: FindingRecord[];
      notAssessed: string[];
      origins: string[];
    }
  | { found: false };

export async function getCaseDetails(id: string): Promise<CaseDetailsResult> {
  try {
    const orgId = await getAuthOrgId();
    const caseRecord = await getCase(id, orgId, getCaseDeps());

    // Load findings from the findings table so the discrepancy ledger is
    // populated for seeded demo cases (BE-15).
    const db = getDb();
    const allFindings = await getFindingsByCase(db, id);
    const findings = allFindings.filter((f) => f.status !== 'not_assessed');
    const notAssessed = allFindings
      .filter((f) => f.status === 'not_assessed')
      .map((f) => f.rule_id);

    const originsSet = new Set<string>();
    const docKinds = await listDocumentKindsByCase(db, id);
    docKinds.forEach((k) => originsSet.add(k === 'form_16' ? 'form16' : k));

    const epfoRecords = await db
      .select({ id: schema.epfoRecords.id })
      .from(schema.epfoRecords)
      .where(eq(schema.epfoRecords.case_id, id))
      .limit(1);
    if (epfoRecords.length > 0) {
      originsSet.add('epfo');
    }

    return {
      found: true,
      caseRecord,
      findings,
      notAssessed,
      origins: Array.from(originsSet),
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
