// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
import { DisputeForm } from '../src/components/candidate/DisputeForm';
import { DisputeStatus } from '../src/components/ledger/DisputeStatus';
import { FindingCard } from '../src/components/ledger/FindingCard';
import { disputeFinding } from '../src/lib/api/candidate';
import type { FindingRecord } from '@tieout/schema';

// Mock the API client
vi.mock('../src/lib/api/candidate', () => ({
  disputeFinding: vi.fn(),
}));

const mockFinding: FindingRecord = {
  id: 'find-123',
  case_id: 'case-123',
  rule_id: 'CHK-PAYSLIP-ARITH',
  severity: 'high',
  status: 'open',
  title: 'Basic Pay Mismatch',
  explanation: 'Basic pay does not match expectations',
  expected: '50000',
  observed: '40000',
  source_document_ids: ['doc-123'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Dispute UI', () => {
  describe('DisputeForm', () => {
    it('disables submit button when reason is empty', () => {
      render(<DisputeForm token="test-token" findingId="find-123" />);
      const button = screen.getByRole('button', { name: /Submit Dispute/i });
      expect(button).toBeDisabled();
    });

    it('submits successfully and shows success state', async () => {
      vi.mocked(disputeFinding).mockResolvedValueOnce();
      const onSuccessMock = vi.fn();

      render(<DisputeForm token="test-token" findingId="find-123" onSuccess={onSuccessMock} />);

      const textarea = screen.getByRole('textbox', { name: /Reason for dispute/i });
      fireEvent.change(textarea, { target: { value: 'This is my reason' } });

      const button = screen.getByRole('button', { name: /Submit Dispute/i });
      expect(button).not.toBeDisabled();
      fireEvent.click(button);

      expect(screen.getByRole('button', { name: /Submitting/i })).toBeDisabled();
      expect(disputeFinding).toHaveBeenCalledWith('test-token', 'find-123', 'This is my reason');

      await waitFor(() => {
        expect(screen.getByText(/Dispute submitted successfully/i)).toBeInTheDocument();
      });

      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });

    it('shows error message if API fails', async () => {
      vi.mocked(disputeFinding).mockRejectedValueOnce(new Error('Network Error'));

      render(<DisputeForm token="test-token" findingId="find-123" />);

      const textarea = screen.getByRole('textbox', { name: /Reason for dispute/i });
      fireEvent.change(textarea, { target: { value: 'This is my reason' } });

      const button = screen.getByRole('button', { name: /Submit Dispute/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
      });
    });
  });

  describe('DisputeStatus', () => {
    it('renders nothing if finding is not disputed', () => {
      const { container } = render(<DisputeStatus finding={mockFinding} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the dispute reason if finding is disputed', () => {
      const disputedFinding = {
        ...mockFinding,
        status: 'disputed' as const,
        dispute_reason: 'The candidate says: The mismatch is due to pro-rated days.',
      };
      render(<DisputeStatus finding={disputedFinding} />);

      expect(screen.getByText(/Finding Disputed by Candidate/i)).toBeInTheDocument();
      expect(screen.getByText(/The mismatch is due to pro-rated days/i)).toBeInTheDocument();
    });
  });

  describe('FindingCard Integration', () => {
    it('renders DisputeForm if candidateToken is provided and status is open', () => {
      render(<FindingCard finding={mockFinding} candidateToken="cand-123" />);
      expect(screen.getByText(/Dispute this finding/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit Dispute/i })).toBeInTheDocument();
    });

    it('does not render DisputeForm if candidateToken is NOT provided', () => {
      render(<FindingCard finding={mockFinding} />);
      expect(screen.queryByText(/Dispute this finding/i)).toBeNull();
    });

    it('renders DisputeStatus if finding is already disputed', () => {
      const disputedFinding = {
        ...mockFinding,
        status: 'disputed' as const,
        dispute_reason: 'I am right',
      };
      // Even with candidate token, it should not render form if status is not open
      render(<FindingCard finding={disputedFinding} candidateToken="cand-123" />);
      expect(screen.queryByText(/Dispute this finding/i)).toBeNull();
      expect(screen.getByText(/Finding Disputed by Candidate/i)).toBeInTheDocument();
    });
  });
});
