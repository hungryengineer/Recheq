import type { CaseStatus, DocumentKind } from '@tieout/schema';
import { apiClient } from './client';

export interface PublicCaseContext {
  orgName: string;
  employerName: string;
  candidateName: string;
  status: CaseStatus;
  documentsRequired: DocumentKind[];
  documentsProvided: DocumentKind[];
}

export async function getCaseByToken(token: string): Promise<PublicCaseContext> {
  const result = await apiClient<Record<string, unknown>>(`/public/${token}`);
  return {
    orgName: String(result.org_name),
    employerName: String(result.employer_name),
    candidateName: String(result.candidate_name),
    status: result.status as CaseStatus,
    documentsRequired: ['payslip', 'form_16'],
    documentsProvided: [],
  };
}

export async function grantConsent(token: string, _ip: string = '0.0.0.0', _userAgent: string = 'unknown'): Promise<void> {
  await apiClient(`/public/${token}/consent`, { method: 'POST' });
}

export async function withdrawConsent(token: string): Promise<void> {
  await apiClient(`/public/${token}/consent`, { method: 'DELETE' });
}

export async function uploadDocument(token: string, kind: DocumentKind, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);

  await apiClient(`/public/${token}/documents`, {
    method: 'POST',
    body: formData,
  });
}

export async function submitUan(token: string, uan: string): Promise<void> {
  await apiClient(`/public/${token}/uan`, {
    method: 'POST',
    body: JSON.stringify({ uan }),
  });
}

export async function submitDocuments(token: string): Promise<void> {
  await apiClient(`/public/${token}/documents/submit`, { method: 'POST' });
}

export async function disputeFinding(
  token: string,
  findingId: string,
  reason: string,
): Promise<void> {
  await apiClient(`/public/${token}/dispute`, {
    method: 'POST',
    body: JSON.stringify({ finding_id: findingId, reason }),
  });
}
