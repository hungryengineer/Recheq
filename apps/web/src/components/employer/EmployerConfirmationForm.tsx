'use client';

import React, { useState } from 'react';
import type { PublicEmployerContext } from '../../lib/api/employer';
import { submitEmployerResponse } from '../../lib/api/employer';

interface Props {
  token: string;
  context: PublicEmployerContext;
  onSuccess: () => void;
}

export function EmployerConfirmationForm({ token, context, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameMatches, setNameMatches] = useState<boolean>(true);
  const [correctedName, setCorrectedName] = useState('');

  const [titleMatches, setTitleMatches] = useState<boolean>(true);
  const [correctedTitle, setCorrectedTitle] = useState('');

  const [ctcMatches, setCtcMatches] = useState<boolean>(true);
  const [correctedCtc, setCorrectedCtc] = useState('');

  const [note, setNote] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!nameMatches && !correctedName.trim()) {
      setError('Please provide the corrected name.');
      return;
    }
    if (!titleMatches && !correctedTitle.trim()) {
      setError('Please provide the corrected title.');
      return;
    }
    if (!ctcMatches && (!correctedCtc.trim() || isNaN(Number(correctedCtc)))) {
      setError('Please provide a valid corrected CTC.');
      return;
    }

    const isAllConfirmed = nameMatches && titleMatches && ctcMatches;

    const payload = {
      confirmed: isAllConfirmed,
      corrected_name: !nameMatches ? correctedName.trim() : undefined,
      corrected_title: !titleMatches ? correctedTitle.trim() : undefined,
      corrected_ctc: !ctcMatches ? Number(correctedCtc) : undefined,
      note: note.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await submitEmployerResponse(token, payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
      <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Employment Verification</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Please confirm the details provided by the candidate.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6 space-y-8">
        {error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Candidate Name */}
        <div>
          <h4 className="text-sm font-medium text-gray-900">Candidate Name</h4>
          <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-100">
            {context.candidate_name}
          </p>

          <div className="mt-3 flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-600"
                checked={nameMatches === true}
                onChange={() => setNameMatches(true)}
              />
              <span className="ml-2 text-sm text-gray-700">Matches our records</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-600"
                checked={nameMatches === false}
                onChange={() => setNameMatches(false)}
              />
              <span className="ml-2 text-sm text-gray-700">Needs correction</span>
            </label>
          </div>

          {!nameMatches && (
            <div className="mt-3">
              <label htmlFor="correctedName" className="sr-only">
                Corrected Name
              </label>
              <input
                type="text"
                id="correctedName"
                value={correctedName}
                onChange={(e) => setCorrectedName(e.target.value)}
                placeholder="Enter correct name"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <h4 className="text-sm font-medium text-gray-900">Job Title</h4>
          <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-100">
            {context.title}
          </p>

          <div className="mt-3 flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-600"
                checked={titleMatches === true}
                onChange={() => setTitleMatches(true)}
              />
              <span className="ml-2 text-sm text-gray-700">Matches our records</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-600"
                checked={titleMatches === false}
                onChange={() => setTitleMatches(false)}
              />
              <span className="ml-2 text-sm text-gray-700">Needs correction</span>
            </label>
          </div>

          {!titleMatches && (
            <div className="mt-3">
              <label htmlFor="correctedTitle" className="sr-only">
                Corrected Title
              </label>
              <input
                type="text"
                id="correctedTitle"
                value={correctedTitle}
                onChange={(e) => setCorrectedTitle(e.target.value)}
                placeholder="Enter correct title"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          )}
        </div>

        {/* CTC */}
        <div>
          <h4 className="text-sm font-medium text-gray-900">Total Compensation (CTC)</h4>
          <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-100">
            {formatCurrency(context.claimed_ctc)}
          </p>

          <div className="mt-3 flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-600"
                checked={ctcMatches === true}
                onChange={() => setCtcMatches(true)}
              />
              <span className="ml-2 text-sm text-gray-700">Matches our records</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-600"
                checked={ctcMatches === false}
                onChange={() => setCtcMatches(false)}
              />
              <span className="ml-2 text-sm text-gray-700">Needs correction</span>
            </label>
          </div>

          {!ctcMatches && (
            <div className="mt-3">
              <label htmlFor="correctedCtc" className="sr-only">
                Corrected CTC
              </label>
              <input
                type="number"
                id="correctedCtc"
                value={correctedCtc}
                onChange={(e) => setCorrectedCtc(e.target.value)}
                placeholder="Enter correct CTC (Numbers only)"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          )}
        </div>

        <hr className="border-gray-200" />

        {/* Optional Note */}
        <div>
          <label htmlFor="note" className="block text-sm font-medium text-gray-900">
            Additional Notes (Optional)
          </label>
          <div className="mt-2">
            <textarea
              id="note"
              rows={3}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any context you'd like to provide to the background verification team..."
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {submitting ? 'Submitting...' : 'Submit Verification'}
          </button>
        </div>
      </form>
    </div>
  );
}
