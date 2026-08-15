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
    
    // Status steps: payslip, form16, epfo, rules
    const hasPayslip = documents.some(d => d.kind === 'payslip');
    const hasForm16 = documents.some(d => d.kind === 'form_16');
    const epfoRecords = await deps.db.getCompletedEpfoRecords(caseId);
    
    const steps = [
      {
        key: 'payslip',
        label: 'Payslip Processing',
        state: hasPayslip ? 'done' : 'pending'
      },
      {
        key: 'form16',
        label: 'Form 16 Analysis',
        state: hasForm16 ? 'done' : 'pending'
      },
      {
        key: 'epfo',
        label: 'EPFO Verification',
        state: epfoRecords.length > 0 ? 'done' : (caseRecord.status === 'processing' || caseRecord.status === 'complete' ? 'done' : 'pending')
      },
      {
        key: 'rules',
        label: 'Rule Evaluation',
        state: caseRecord.status === 'complete' ? 'done' : (caseRecord.status === 'processing' ? 'active' : 'pending')
      }
    ];

    return {
      status: 200,
      body: {
        status: caseRecord.status,
        documents_total: documents.length,
        documents_extracted: documents.length, // simplify for now
        steps
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
