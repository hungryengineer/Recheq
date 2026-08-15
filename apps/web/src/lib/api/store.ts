import type { CaseRecord } from '@tieout/schema';

const globalForStore = globalThis as unknown as {
  mockCases: CaseRecord[];
};

if (!globalForStore.mockCases) {
  globalForStore.mockCases = [
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
    },
  ];
}

export const mockCases = globalForStore.mockCases;

// Helper to simulate network latency
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
