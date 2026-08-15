import type { CaseRecord, CaseSummary, FindingRecord } from '@tieout/schema';
import { getCase, listCases } from '@tieout/api/web';
import { getCaseDeps, DEV_ORG_ID } from './db';

export async function getCases(): Promise<CaseSummary[]> {
  return await listCases(DEV_ORG_ID, getCaseDeps());
}

export async function getCaseDetails(id: string): Promise<{
  caseRecord: CaseRecord;
  findings: FindingRecord[];
  notAssessed: string[];
}> {
  const caseRecord = await getCase(id, DEV_ORG_ID, getCaseDeps());

  return {
    caseRecord,
    findings: [],
    notAssessed: [],
  };
}
