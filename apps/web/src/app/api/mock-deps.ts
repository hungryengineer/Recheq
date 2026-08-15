import type { CaseServiceDeps } from '@tieout/api';
import type { CaseRecord, CaseSummary } from '@tieout/schema';

// Shared mock state
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
  },
];

export const mockDeps: CaseServiceDeps = {
  db: {
    createCase: async (input) => {
      const newCase: CaseRecord = {
        ...input,
        id: `case-${Math.random().toString(36).substring(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockCases.unshift(newCase);
      return newCase;
    },
    listCasesByOrg: async (orgId) => {
      return mockCases
        .filter((c) => c.org_id === orgId)
        .map((c) => ({
          id: c.id,
          employer_name: c.employer_name,
          candidate_name: c.candidate_name,
          title: c.title,
          status: c.status,
          verdict: c.verdict,
          risk_score: c.risk_score,
          created_at: c.created_at,
        }));
    },
    getCaseByIdAndOrg: async (caseId, orgId) => {
      return mockCases.find((c) => c.id === caseId && c.org_id === orgId) || null;
    },
  },
};
