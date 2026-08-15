import type { CaseRecord, CaseSummary, CaseCreateInput, FindingRecord } from '@tieout/schema';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

export async function getCases(): Promise<CaseSummary[]> {
  const res = await fetch(`${getBaseUrl()}/api/cases`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch cases');
  return res.json();
}

export async function createCase(input: CaseCreateInput): Promise<CaseRecord> {
  const res = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create case');
  return res.json();
}

export async function getCaseDetails(id: string): Promise<{
  caseRecord: CaseRecord;
  findings: FindingRecord[];
  notAssessed: string[];
}> {
  const res = await fetch(`${getBaseUrl()}/api/cases/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch case details');
  return res.json();
}
