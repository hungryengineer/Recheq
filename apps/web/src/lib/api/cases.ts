import type { CaseRecord, CaseSummary, CaseCreateInput, FindingRecord } from '@tieout/schema';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mockCases: CaseRecord[] = [
  {
    id: 'case-001',
    org_id: 'org-001',
    created_by: 'user-001',
    employer_name: 'Acme Corp Background Checks',
    candidate_name: 'John Doe',
    title: 'Software Engineer Background Check',
    claimed_ctc: 1200000,
    employment_start: '2022-01-01',
    employment_end: '2023-12-31',
    uan: '100100100100',
    status: 'complete',
    verdict: 'needs_review',
    risk_score: 55,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'case-002',
    org_id: 'org-001',
    created_by: 'user-001',
    employer_name: 'Globex Inc',
    candidate_name: 'Jane Smith',
    title: 'Senior Product Manager',
    claimed_ctc: 2500000,
    employment_start: '2019-06-01',
    employment_end: '2023-10-31',
    uan: null,
    status: 'processing',
    verdict: null,
    risk_score: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  }
];

const mockFindings: FindingRecord[] = [
  {
    id: 'finding-1',
    case_id: 'case-001',
    rule_id: 'CHK-PAYSLIP-ARITH',
    severity: 'high',
    status: 'open',
    title: 'Payslip Arithmetic Mismatch',
    explanation: 'The sum of all earnings and deductions does not match the stated net pay.',
    expected: '85000',
    observed: '92000',
    source_document_ids: ['doc-1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'finding-2',
    case_id: 'case-001',
    rule_id: 'CHK-CTC-PLAUSIBLE',
    severity: 'medium',
    status: 'open',
    title: 'CTC Implausible',
    explanation: 'The annualized gross salary derived from the payslip deviates significantly from the claimed CTC.',
    expected: '1200000',
    observed: '1020000',
    source_document_ids: ['doc-1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'finding-3',
    case_id: 'case-001',
    rule_id: 'CHK-FORENSICS-META',
    severity: 'low',
    status: 'open',
    title: 'Suspicious PDF Producer',
    explanation: 'The payslip PDF was generated using software known for editing (e.g. Adobe Illustrator).',
    expected: 'Standard payroll software',
    observed: 'Adobe Illustrator',
    source_document_ids: ['doc-1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const mockNotAssessed = [
  'CHK-PF-IMPLIES-BASIC',
  'CHK-FORM16-RECONCILES',
];

export async function getCases(): Promise<CaseSummary[]> {
  await delay(800);
  return mockCases.map(c => ({
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

export async function createCase(input: CaseCreateInput): Promise<CaseRecord> {
  await delay(1200);
  const newCase: CaseRecord = {
    ...input,
    id: `case-${Math.random().toString(36).substr(2, 9)}`,
    org_id: 'org-001',
    created_by: 'user-001',
    uan: input.uan || null,
    status: 'draft',
    verdict: null,
    risk_score: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockCases.unshift(newCase);
  return newCase;
}

export async function getCaseDetails(id: string): Promise<{
  caseRecord: CaseRecord;
  findings: FindingRecord[];
  notAssessed: string[];
}> {
  await delay(1000);
  const caseRecord = mockCases.find(c => c.id === id);
  
  if (!caseRecord) {
    throw new Error('CASE_NOT_FOUND');
  }

  // Only return findings for case-001 for demo purposes
  const findings = id === 'case-001' ? mockFindings : [];
  const notAssessed = id === 'case-001' ? mockNotAssessed : [];

  return {
    caseRecord,
    findings,
    notAssessed,
  };
}
