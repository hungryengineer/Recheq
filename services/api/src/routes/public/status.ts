import type { RequestContext } from '../../observability/request-context.js';
import { toErrorResponse, AppError } from '../../http/errors.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import type { CaseRecord, DocumentRecord } from '@recheq/schema';
import type { EpfoHistory } from '@recheq/rules';
import { projectPublicSteps, type ExtractionLike } from '../../workflows/step-projection.js';

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
    /** Extraction rows for documents of the case (timing + derived states). */
    getExtractionsForCase: (documentIds: string[]) => Promise<ExtractionLike[]>;
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
    const epfoRecords = await deps.db.getCompletedEpfoRecords(caseId);

    const extractions: ExtractionLike[] =
      documents.length > 0 ? await deps.db.getExtractionsForCase(documents.map((d) => d.id)) : [];

    // P5 — candidate view only ever receives the contract fields.
    const steps = projectPublicSteps({
      caseRecord,
      caseCreatedAt: caseRecord.created_at,
      documents,
      extractions,
      epfoRecords,
    });

    return {
      status: 200,
      body: {
        status: caseRecord.status,
        documents_total: documents.length,
        documents_extracted: documents.filter((d) => d.status === 'extracted').length,
        steps,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
