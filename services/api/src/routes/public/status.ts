import type { RequestContext } from '../../observability/request-context.js';
import { toErrorResponse, AppError } from '../../http/errors.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import type { CaseRecord, DocumentRecord } from '@tieout/schema';
import type { EpfoHistory } from '@tieout/rules';

export interface StatusRouteRequest {
  params: {
    token: string;
  };
  context: RequestContext;
}

export interface StatusRouteDeps {
  tokenVerifier: TokenVerifier;
  db: {
    getCaseById: (caseId: string) => Promise<CaseRecord | null>;
    getDocumentsForCase: (caseId: string) => Promise<DocumentRecord[]>;
    getCompletedEpfoRecords: (caseId: string) => Promise<{ employment_history: EpfoHistory }[]>;
    // Optional additional status getters can be added here
  };
}

export async function getStatusHandler(req: StatusRouteRequest, deps: StatusRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);
    const caseRecord = await deps.db.getCaseById(caseId);

    if (!caseRecord) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found');
    }

    const documents = await deps.db.getDocumentsForCase(caseId);
    // Determine extractions count from documents logic if needed
    // In actual implementation we might fetch extractions, but this is a simplified view
    const epfoRecords = await deps.db.getCompletedEpfoRecords(caseId);

    const getDocState = (kind: string) => {
      const docs = documents.filter((d) => d.kind === kind);
      if (docs.length === 0) {
        if (caseRecord.status === 'complete') return 'not_assessed';
        return 'pending';
      }
      if (docs.some((d) => d.status === 'failed')) return 'failed';
      if (docs.every((d) => d.status === 'extracted')) return 'succeeded';
      if (caseRecord.status === 'processing') return 'running';
      return 'pending';
    };

    const getEpfoState = () => {
      if (epfoRecords.length > 0) return 'succeeded';
      if (caseRecord.status === 'processing') return 'awaiting_external';
      if (caseRecord.status === 'complete') return 'not_assessed';
      return 'pending';
    };

    const steps = [
      {
        id: 'payslip',
        label: 'Payslip Processing',
        state: getDocState('payslip'),
        started_at: new Date().toISOString(),
      },
      {
        id: 'form16',
        label: 'Form 16 Analysis',
        state: getDocState('form_16'),
        started_at: new Date().toISOString(),
      },
      {
        id: 'epfo',
        label: 'EPFO Verification',
        state: getEpfoState(),
        started_at: new Date().toISOString(),
      },
      {
        id: 'rules',
        label: 'Rule Evaluation',
        state:
          caseRecord.status === 'complete'
            ? 'succeeded'
            : caseRecord.status === 'processing'
              ? 'running'
              : 'pending',
        started_at: new Date().toISOString(),
      },
    ];

    return {
      status: 200,
      body: {
        status: caseRecord.status,
        documents_total: documents.length,
        documents_extracted: documents.length, // simplify for now
        steps,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
