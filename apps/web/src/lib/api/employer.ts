// We simulate backend latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PublicEmployerContext {
  candidate_name: string;
  title: string;
  claimed_ctc: number;
  employer_email: string;
  status: 'pending' | 'submitted';
}

export interface EmployerResponsePayload {
  confirmed: boolean;
  corrected_name?: string;
  corrected_title?: string;
  corrected_ctc?: number;
  note?: string;
}

// Temporary in-memory state since we are mocking the backend for the frontend milestones
const mockState: Record<string, PublicEmployerContext> = {
  'test-token': {
    candidate_name: 'John Doe',
    title: 'Senior Software Engineer',
    claimed_ctc: 150000,
    employer_email: 'hr@acmecorp.com',
    status: 'pending',
  },
  'submitted-token': {
    candidate_name: 'Jane Smith',
    title: 'Product Manager',
    claimed_ctc: 120000,
    employer_email: 'hr@acmecorp.com',
    status: 'submitted',
  },
};

export async function getEmployerForm(token: string): Promise<PublicEmployerContext> {
  await delay(800);

  if (token === 'expired') {
    throw new Error('TOKEN_EXPIRED');
  }

  if (token === 'invalid') {
    throw new Error('TOKEN_INVALID');
  }

  const data = mockState[token] || mockState['test-token'];
  return { ...data };
}

export async function submitEmployerResponse(
  token: string,
  _payload: EmployerResponsePayload,
): Promise<void> {
  await delay(1000);

  if (token === 'expired') {
    throw new Error('TOKEN_EXPIRED');
  }
  if (token === 'invalid') {
    throw new Error('TOKEN_INVALID');
  }

  const data = mockState[token];
  if (data?.status === 'submitted') {
    throw new Error('REQUEST_ALREADY_RESPONDED');
  }

  // Update mock state
  if (data) {
    data.status = 'submitted';
  }
}
