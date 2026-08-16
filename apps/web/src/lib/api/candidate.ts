import type { CaseStatus, DocumentKind } from '@tieout/schema';

export interface PublicCaseContext {
  orgName: string;
  employerName: string;
  candidateName: string;
  status: CaseStatus;
  documentsRequired: DocumentKind[];
  documentsProvided: DocumentKind[];
}

interface CandidateResponse {
  orgName: string;
  employerName: string;
  candidateName: string;
  title: string;
  status: CaseStatus;
  consent_status: 'pending' | 'granted' | 'withdrawn' | null;
  documentsRequired: DocumentKind[];
  documentsProvided: DocumentKind[];
}

// Shown to the candidate on the consent page; kept in sync with the
// consent text stored on the server when consent is granted.
const CONSENT_TEXT =
  'I consent to Tieout performing a background verification of my employment and compensation history with the employer named in this verification request.';
const CONSENT_VERSION = '1';

export async function getCaseByToken(token: string): Promise<PublicCaseContext> {
  const response = await fetch(`/api/public/${token}/candidate`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 410) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error('TOKEN_INVALID');
  }

  const data: CandidateResponse = await response.json();
  return {
    orgName: data.orgName,
    employerName: data.employerName,
    candidateName: data.candidateName,
    status: data.status,
    documentsRequired: data.documentsRequired,
    documentsProvided: data.documentsProvided,
  };
}

export async function grantConsent(token: string, _ip: string, _userAgent: string): Promise<void> {
  const response = await fetch(`/api/public/${token}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_text: CONSENT_TEXT, consent_version: CONSENT_VERSION }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 410) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(data?.message || 'Failed to grant consent');
  }
}

export async function withdrawConsent(token: string): Promise<void> {
  const response = await fetch(`/api/public/${token}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 410) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(data?.message || 'Failed to withdraw consent');
  }
}

export async function uploadDocument(token: string, kind: DocumentKind, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file);

  const response = await fetch(`/api/public/${token}/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 410) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (response.status === 413) {
      throw new Error('FILE_TOO_LARGE');
    }
    throw new Error(data?.message || 'Failed to upload document');
  }
}

export async function submitUan(_token: string, _uan: string): Promise<void> {
  // UAN submission is not yet wired to the backend; the EPFO pull runs later.
}

export async function submitDocuments(_token: string): Promise<void> {
  // Submitting the document set transitions the case to processing on the
  // backend. Not wired yet, so treat it as a no-op for now.
}

export async function disputeFinding(
  token: string,
  findingId: string,
  reason: string,
): Promise<void> {
  if (reason.trim().length === 0) {
    throw new Error('Dispute reason is required');
  }

  const response = await fetch(`/api/public/${token}/dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ finding_id: findingId, reason }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || 'Failed to submit dispute');
  }
}
