// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEmployerForm, submitEmployerResponse } from '../src/lib/api/employer';
import EmployerVerificationPage from '../src/app/e/[token]/page';

afterEach(() => {
  cleanup();
});

// Mock the API client
vi.mock('../src/lib/api/employer', () => ({
  getEmployerForm: vi.fn(),
  submitEmployerResponse: vi.fn(),
}));

const mockContext = {
  candidate_name: 'John Doe',
  title: 'Senior Software Engineer',
  claimed_ctc: 150000,
  employer_email: 'hr@acmecorp.com',
  status: 'pending' as const,
};

function createResolvedPromise(value: any) {
  const promise = Promise.resolve(value) as any;
  promise.status = 'fulfilled';
  promise.value = value;
  return promise;
}

describe('Employer Page UI', () => {
  it('shows error state for invalid token', async () => {
    vi.mocked(getEmployerForm).mockRejectedValueOnce(new Error('TOKEN_INVALID'));

    const params = createResolvedPromise({ token: 'invalid' });
    await act(async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <EmployerVerificationPage params={params} />
        </React.Suspense>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/This verification link is invalid/i)).toBeInTheDocument();
    });
  });

  it('shows error state for expired token', async () => {
    vi.mocked(getEmployerForm).mockRejectedValueOnce(new Error('TOKEN_EXPIRED'));

    const params = createResolvedPromise({ token: 'expired' });
    await act(async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <EmployerVerificationPage params={params} />
        </React.Suspense>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/This verification link has expired/i)).toBeInTheDocument();
    });
  });

  it('shows success state if already submitted', async () => {
    vi.mocked(getEmployerForm).mockResolvedValueOnce({
      ...mockContext,
      status: 'submitted',
    });

    const params = createResolvedPromise({ token: 'test-token' });
    await act(async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <EmployerVerificationPage params={params} />
        </React.Suspense>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Response Recorded/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Thank you for verifying employment details for John Doe/i),
      ).toBeInTheDocument();
    });
  });

  it('renders form and submits successfully', async () => {
    vi.mocked(getEmployerForm).mockResolvedValueOnce(mockContext);
    vi.mocked(submitEmployerResponse).mockResolvedValueOnce();

    const params = createResolvedPromise({ token: 'test-token' });
    await act(async () => {
      render(<EmployerVerificationPage params={params} />);
    });

    // Wait for the form to load
    const heading = await screen.findByText('Employment Verification', {}, { timeout: 3000 });
    expect(heading).toBeInTheDocument();

    // Check that context is rendered
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument();

    // The user selects "Needs correction" for CTC
    const ctcRadios = screen.getAllByRole('radio');
    fireEvent.click(ctcRadios[5]);

    // An input should appear for the corrected CTC
    const ctcInput = await screen.findByPlaceholderText(/Enter correct CTC/i);
    fireEvent.change(ctcInput, { target: { value: '140000' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Submit Verification/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Assert API call
    expect(submitEmployerResponse).toHaveBeenCalledWith('test-token', {
      confirmed: false,
      corrected_name: undefined,
      corrected_title: undefined,
      corrected_ctc: 140000,
      note: undefined,
    });
  });
});
