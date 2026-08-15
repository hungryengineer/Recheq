import type { CaseRecord, CaseSummary, FindingRecord } from '@tieout/schema';
import { mockCases, delay } from './store';

export async function getCases(): Promise<CaseSummary[]> {
  await delay(300);
  return mockCases.map((c) => ({
    id: c.id,
    employer_name: c.employer_name,
    candidate_name: c.candidate_name,
    title: c.title,
    status: c.status,
    verdict: c.verdict,
    risk_score: c.risk_score,
    created_at: c.created_at,
  }));
}

export async function getCaseDetails(id: string): Promise<{
  caseRecord: CaseRecord;
  findings: FindingRecord[];
  notAssessed: string[];
}> {
  await delay(400);
  const caseRecord = mockCases.find((c) => c.id === id);

  if (!caseRecord) {
    throw new Error('Case not found');
  }

  const mockFindings: FindingRecord[] =
    id === 'case-001'
      ? [
          {
            id: 'finding-1',
            case_id: 'case-001',
            rule_id: 'CHK-PAYSLIP-ARITH',
            severity: 'high',
            status: 'open',
            title: 'Payslip Arithmetic Mismatch',
            explanation:
              'The sum of all earnings and deductions does not match the stated net pay.',
            expected: '85000',
            observed: '92000',
            source_document_ids: ['doc-1'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      : [];

  return {
    caseRecord,
    findings: mockFindings,
    notAssessed: id === 'case-001' ? ['CHK-PF-IMPLIES-BASIC'] : [],
  };
}
