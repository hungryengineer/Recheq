import { NextResponse } from 'next/server';
import { getCandidateView, resolveToken, listDocumentKindsByCase, toErrorResponse } from '@tieout/api/web';
import type { CandidateSafeView } from '@tieout/api/web';
import { getDb } from '@/lib/api/db';
import { getConsentDeps, getTokenVerifier } from '@/lib/api/public';

const REQUIRED_DOCUMENTS = ['payslip', 'form_16'] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const db = getDb();
    const consentDeps = getConsentDeps();
    const tokenVerifier = getTokenVerifier();

    const caseId = await resolveToken(token, 'consent', tokenVerifier);
    const view: CandidateSafeView = await getCandidateView(caseId, consentDeps);
    const documentsProvided = await listDocumentKindsByCase(db, caseId);

    return NextResponse.json({
      orgName: 'Tieout',
      employerName: view.employer_name,
      candidateName: view.candidate_name,
      title: view.title,
      status: view.status,
      consent_status: view.consent_status,
      documentsRequired: [...REQUIRED_DOCUMENTS],
      documentsProvided,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
