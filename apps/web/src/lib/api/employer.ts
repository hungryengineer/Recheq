// DEMO: not wired, employer path cut
import type { CaseStatus } from '@tieout/schema';

// We simulate backend latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PublicEmployerContext {
  orgName: string;
  candidateName: string;
  claimedTitle: string;
  claimedCtc: number;
  claimedStart: string;
  claimedEnd: string;
  status: CaseStatus;
}

export interface EmployerConfirmationInput {
  candidateNameMatches: boolean;
  actualCandidateName?: string;
  titleMatches: boolean;
  actualTitle?: string;
  ctcMatches: boolean;
  actualCtc?: number;
  datesMatch: boolean;
  actualStart?: string;
  actualEnd?: string;
  note?: string;
}

// Temporary in-memory state since we are mocking the backend for the frontend milestones
const mockState: Record<string, PublicEmployerContext> = {
  'test-token': {
    orgName: 'Acme Corp',
    candidateName: 'John Doe',
    claimedTitle: 'Senior Engineer',
    claimedCtc: 4500000,
    claimedStart: '2021-01-01',
    claimedEnd: '2023-12-31',
    status: 'processing',
  },
};

export async function getEmployerContextByToken(token: string): Promise<PublicEmployerContext> {
  await delay(800);

  if (token === 'invalid') {
    throw new Error('TOKEN_INVALID');
  }

  const context = mockState[token];
  if (!context) {
    // For demo purposes, if it's an unknown token, just return a fake one
    return mockState['test-token'];
  }

  return { ...context };
}

export async function submitEmployerConfirmation(
  _token: string,
  _data: EmployerConfirmationInput,
): Promise<void> {
  await delay(1200);
  // In a real app this would save to the DB and update the case
}
