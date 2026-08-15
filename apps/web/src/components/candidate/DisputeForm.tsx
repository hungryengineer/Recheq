'use client';

import React, { useState } from 'react';
import { disputeFinding } from '@/lib/api/candidate';

interface DisputeFormProps {
  token: string;
  findingId: string;
  onSuccess?: () => void;
}

export function DisputeForm({ token, findingId, onSuccess }: DisputeFormProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for disputing this finding.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await disputeFinding(token, findingId, reason);
      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while submitting the dispute.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="mt-4 p-4 rounded-md bg-green-50 border border-green-200"
        data-testid="dispute-success"
      >
        <p className="text-sm font-medium text-green-800">
          Dispute submitted successfully. Our team will review the context provided.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-md bg-gray-50 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-900 mb-2">Dispute this finding</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor={`dispute-reason-${findingId}`} className="sr-only">
            Reason for dispute
          </label>
          <textarea
            id={`dispute-reason-${findingId}`}
            name="reason"
            rows={3}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-colors duration-200"
            placeholder="Please explain why you believe this finding is incorrect..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !reason.trim()}
            className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? 'Submitting...' : 'Submit Dispute'}
          </button>
        </div>
      </form>
    </div>
  );
}
