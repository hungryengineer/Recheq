import type { CaseStatus, DocumentKind } from '@tieout/schema';

// We simulate backend latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PublicCaseContext {
  orgName: string;
  employerName: string;
  candidateName: string;
  status: CaseStatus;
  documentsRequired: DocumentKind[];
  documentsProvided: DocumentKind[];
}

// Temporary in-memory state since we are mocking the backend for the frontend milestones
const mockState: PublicCaseContext = {
  orgName: 'Acme Corp',
  employerName: 'Acme Corp Background Checks',
  candidateName: 'John Doe',
  status: 'awaiting_consent',
  documentsRequired: ['payslip', 'form_16'],
  documentsProvided: [],
};

export async function getCaseByToken(token: string): Promise<PublicCaseContext> {
  await delay(800);

  if (token === 'expired') {
    throw new Error('TOKEN_EXPIRED');
  }

  if (token === 'invalid') {
    throw new Error('TOKEN_INVALID');
  }

  return { ...mockState };
}

export async function grantConsent(_token: string, _ip: string, _userAgent: string): Promise<void> {
  await delay(1000);
  mockState.status = 'awaiting_documents';
}

export async function withdrawConsent(_token: string): Promise<void> {
  await delay(1000);
  mockState.status = 'withdrawn';
}

export async function uploadDocument(
  _token: string,
  kind: DocumentKind,
  file: File,
): Promise<void> {
  await delay(1500);

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('FILE_TOO_LARGE');
  }

  if (!mockState.documentsProvided.includes(kind)) {
    mockState.documentsProvided.push(kind);
  }
}

export async function submitUan(_token: string, _uan: string): Promise<void> {
  await delay(1000);
  // Just a simulation, normally the backend stores this and processes EPFO
}

export async function submitDocuments(_token: string): Promise<void> {
  await delay(1000);
  // Simulating the transition to processing
  mockState.status = 'processing';

  // Simulate processing time
  setTimeout(() => {
    if (mockState.status === 'processing') {
      mockState.status = 'complete';
    }
  }, 5000);
}

export async function disputeFinding(
  _token: string,
  _findingId: string,
  reason: string,
): Promise<void> {
  await delay(1000);

  if (reason.trim().length === 0) {
    throw new Error('Dispute reason is required');
  }

  // Simulate API call to backend dispute endpoint
}

