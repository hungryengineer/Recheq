// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { ConsentSummary } from '../src/components/candidate/ConsentSummary';
import { ConsentAction } from '../src/components/candidate/ConsentAction';
import { grantConsent } from '../src/lib/api/candidate';

// Mock next/navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

// Mock the API client
vi.mock('../src/lib/api/candidate', () => ({
  grantConsent: vi.fn(),
}));

describe('Candidate Consent UI', () => {
  it('renders the mandatory disclosures in ConsentSummary', () => {
    render(<ConsentSummary orgName="TestOrg" />);

    // Acceptance criteria: explains what is collected, why, documents requested, sources checked, retention, third-party processing, withdrawal, and dispute path.
    expect(screen.getByText(/Data Processing Disclosure/i)).toBeTruthy();
    expect(screen.getByText(/Payslips/i)).toBeTruthy();
    expect(screen.getByText(/Form 16/i)).toBeTruthy();
    expect(screen.getByText(/EPFO/i)).toBeTruthy();
    expect(screen.getByText(/TestOrg uses this information strictly to verify/i)).toBeTruthy();
    expect(screen.getByText(/withdraw your consent at any time/i)).toBeTruthy();
  });

  it('requires an explicit action and transitions state in ConsentAction', async () => {
    vi.mocked(grantConsent).mockResolvedValueOnce();

    render(<ConsentAction token="test-token" />);

    const button = screen.getByRole('button', { name: /I Consent & Agree/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    // Button shows processing and is disabled
    expect(screen.getByRole('button', { name: /Processing/i })).toBeDisabled();

    // API is called
    expect(grantConsent).toHaveBeenCalledWith('test-token', expect.any(String), expect.any(String));

    // Redirects to upload page
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/c/test-token/upload');
    });
  });
});
