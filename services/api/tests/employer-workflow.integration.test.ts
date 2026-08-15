import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEmployerRequest,
  getEmployerForm,
  submitEmployerResponse,
  type EmployerServiceDeps,
} from '../src/services/employer/employer-service.js';
import { AppError } from '../src/http/errors.js';

vi.mock('../src/workflows/pgboss.js', () => ({
  publishJob: vi.fn().mockResolvedValue('mock-job-id'),
}));

describe('Employer Workflow', () => {
  let deps: EmployerServiceDeps;

  beforeEach(() => {
    // Mock the external publishJob dynamically if needed,
    // but here we just mock the deps.worker for reprocessing.
    deps = {
      db: {
        transaction: vi.fn(async (cb) => cb({})),
        getCaseById: vi.fn().mockResolvedValue({
          id: 'case-1',
          candidate_name: 'John Doe',
          title: 'Software Engineer',
          claimed_ctc: 100000,
        }),
        createEmployerRequest: vi.fn().mockResolvedValue({ id: 'req-1' }),
        getEmployerRequestByToken: vi.fn(),
        updateEmployerRequestResponse: vi.fn().mockResolvedValue(undefined),
      },
      audit: {
        appendEvent: vi.fn().mockResolvedValue(undefined),
      },
      tokens: {
        saveToken: vi.fn().mockResolvedValue(undefined),
      },
      worker: {
        enqueueReprocess: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  describe('createEmployerRequest', () => {
    it('generates a token and inserts a pending request', async () => {
      const result = await createEmployerRequest('case-1', 'hr@acme.com', deps);

      expect(result.rawToken).toBeDefined();
      expect(result.rawToken.startsWith('emp_')).toBe(true);

      expect(deps.db.createEmployerRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          case_id: 'case-1',
          employer_email: 'hr@acme.com',
        }),
      );

      expect(deps.audit.appendEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          kind: 'employer_request_sent',
          payload: { employer_email: 'hr@acme.com', employer_request_id: 'req-1' },
          actor: 'verifier',
        }),
      );
    });

    it('throws 404 if case not found', async () => {
      vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(null);

      await expect(
        createEmployerRequest('case-not-found', 'hr@acme.com', deps),
      ).rejects.toThrowError(AppError);
    });
  });

  describe('getEmployerForm', () => {
    it('returns restricted case data and status', async () => {
      vi.mocked(deps.db.getEmployerRequestByToken).mockResolvedValueOnce({
        id: 'req-1',
        case_id: 'case-1',
        employer_email: 'hr@acme.com',
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000),
      });

      const form = await getEmployerForm('hash-123', deps);

      expect(form).toEqual({
        candidate_name: 'John Doe',
        title: 'Software Engineer',
        claimed_ctc: 100000,
        employer_email: 'hr@acme.com',
        status: 'pending',
      });
      // Ensure risk score and findings are NOT returned
      expect(form).not.toHaveProperty('risk_score');
      expect(form).not.toHaveProperty('findings');
    });
  });

  describe('submitEmployerResponse', () => {
    it('updates request status and triggers case recomputation', async () => {
      vi.mocked(deps.db.getEmployerRequestByToken).mockResolvedValueOnce({
        id: 'req-1',
        case_id: 'case-1',
        employer_email: 'hr@acme.com',
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000),
      });

      const payload = {
        confirmed: false,
        corrected_title: 'Junior Engineer',
      };

      await submitEmployerResponse('hash-123', payload, deps);

      expect(deps.db.updateEmployerRequestResponse).toHaveBeenCalledWith(
        expect.anything(),
        'req-1',
        payload,
      );

      expect(deps.audit.appendEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          kind: 'employer_response_received',
          actor: 'employer',
        }),
      );

      expect(deps.worker.enqueueReprocess).toHaveBeenCalledWith('case-1');
    });

    it('throws 400 if request is already responded', async () => {
      vi.mocked(deps.db.getEmployerRequestByToken).mockResolvedValueOnce({
        id: 'req-1',
        case_id: 'case-1',
        employer_email: 'hr@hooli.com',
        status: 'responded', // Already responded
        expires_at: new Date(Date.now() + 86400000),
      });

      await expect(
        submitEmployerResponse('hash-123', { confirmed: true }, deps),
      ).rejects.toThrowError(AppError);
    });
  });
});
