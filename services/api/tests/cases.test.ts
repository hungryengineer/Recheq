import { describe, expect, it, vi } from 'vitest';
import { createCase, listCases, getCase, type CaseServiceDeps } from '../src/services/cases/case-service.js';
import { AppError } from '../src/http/errors.js';
import type { CaseRecord, CaseSummary } from '@tieout/schema';

describe('Case Service', () => {
  const mockDeps: CaseServiceDeps = {
    db: {
      createCase: vi.fn(),
      listCasesByOrg: vi.fn(),
      getCaseByIdAndOrg: vi.fn(),
    },
  };

  const validCreateInput = {
    employer_name: 'Acme Corp',
    candidate_name: 'John Doe',
    title: 'Senior Engineer Background Check',
    claimed_ctc: 1500000,
    employment_start: '2020-01-01',
    employment_end: '2023-01-01',
  };

  const orgId = 'org-123';
  const userId = 'user-123';

  describe('createCase', () => {
    it('creates a draft case successfully', async () => {
      const mockResult: CaseRecord = {
        id: 'case-123',
        org_id: orgId,
        created_by: userId,
        employer_name: validCreateInput.employer_name,
        candidate_name: validCreateInput.candidate_name,
        title: validCreateInput.title,
        claimed_ctc: validCreateInput.claimed_ctc,
        employment_start: validCreateInput.employment_start,
        employment_end: validCreateInput.employment_end,
        uan: null,
        status: 'draft',
        verdict: null,
        risk_score: null,
        created_at: '2023-10-01T00:00:00Z',
        updated_at: '2023-10-01T00:00:00Z',
      };
      
      vi.mocked(mockDeps.db.createCase).mockResolvedValueOnce(mockResult);

      const result = await createCase(validCreateInput, userId, orgId, mockDeps);

      expect(result).toEqual(mockResult);
      expect(mockDeps.db.createCase).toHaveBeenCalledWith({
        org_id: orgId,
        created_by: userId,
        employer_name: validCreateInput.employer_name,
        candidate_name: validCreateInput.candidate_name,
        title: validCreateInput.title,
        claimed_ctc: validCreateInput.claimed_ctc,
        employment_start: validCreateInput.employment_start,
        employment_end: validCreateInput.employment_end,
        uan: null,
        status: 'draft',
        verdict: null,
        risk_score: null,
      });
    });

    it('rejects end date before start date', async () => {
      await expect(
        createCase(
          {
            ...validCreateInput,
            employment_start: '2023-01-01',
            employment_end: '2020-01-01',
          },
          userId,
          orgId,
          mockDeps,
        ),
      ).rejects.toThrowError(AppError);
    });

    it('rejects invalid schema inputs', async () => {
      await expect(
        createCase(
          {
            ...validCreateInput,
            claimed_ctc: -100, // Negative CTC invalid
          },
          userId,
          orgId,
          mockDeps,
        ),
      ).rejects.toThrowError(AppError);
    });
  });

  describe('listCases', () => {
    it('returns org-scoped list', async () => {
      const mockList: CaseSummary[] = [
        {
          id: 'case-1',
          employer_name: 'A',
          candidate_name: 'B',
          title: 'C',
          status: 'draft',
          verdict: null,
          risk_score: null,
          created_at: '2023-10-01T00:00:00Z',
        },
      ];
      vi.mocked(mockDeps.db.listCasesByOrg).mockResolvedValueOnce(mockList);

      const result = await listCases(orgId, mockDeps);

      expect(result).toEqual(mockList);
      expect(mockDeps.db.listCasesByOrg).toHaveBeenCalledWith(orgId);
    });
  });

  describe('getCase', () => {
    it('returns case when found in org', async () => {
      const mockCase = { id: 'case-1' } as CaseRecord;
      vi.mocked(mockDeps.db.getCaseByIdAndOrg).mockResolvedValueOnce(mockCase);

      const result = await getCase('case-1', orgId, mockDeps);

      expect(result).toEqual(mockCase);
      expect(mockDeps.db.getCaseByIdAndOrg).toHaveBeenCalledWith('case-1', orgId);
    });

    it('throws 404 when case not found or wrong org', async () => {
      vi.mocked(mockDeps.db.getCaseByIdAndOrg).mockResolvedValueOnce(null);

      await expect(getCase('case-unknown', orgId, mockDeps)).rejects.toThrowError(AppError);
    });
  });
});
