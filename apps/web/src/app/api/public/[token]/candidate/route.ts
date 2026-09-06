import {
  getCandidateView,
  resolveToken,
  listDocumentKindsByCase,
  toErrorResponse,
} from '@recheq/api/web';
import type { CandidateSafeView } from '@recheq/api/web';
import { getDb } from '@/lib/api/db';
import { getConsentDeps, getTokenVerifier } from '@/lib/api/public';
import { toPublicHandler } from '@/lib/server/adapter';

const REQUIRED_DOCUMENTS = ['payslip', 'form_16'] as const;

export const GET = toPublicHandler(async (req: { raw: Request; params: { token: string } }) => {
  const token = req.params.token;

  try {
    const db = getDb();
    const consentDeps = getConsentDeps();
    const tokenVerifier = getTokenVerifier();

    const caseId = await resolveToken(token, 'consent', tokenVerifier);
    const view: CandidateSafeView = await getCandidateView(caseId, consentDeps);
    const documentsProvided = await listDocumentKindsByCase(db, caseId);

    return {
      status: 200,
      body: {
        orgName: 'Recheq',
        employerName: view.employer_name,
        candidateName: view.candidate_name,
        title: view.title,
        claimed_ctc: view.claimed_ctc,
        employment_start: view.employment_start,
        employment_end: view.employment_end,
        uan: view.uan,
        status: view.status,
        consent_status: view.consent_status,
        documentsRequired: [...REQUIRED_DOCUMENTS],
        documentsProvided,
      },
    };
  } catch (error) {
    return toErrorResponse(error);
  }
});
