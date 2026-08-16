'use client';

import React, { useState } from 'react';
import { createCase } from '../../lib/api/actions';

export function CreateCaseForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setGeneralError(null);
    setSuccessLink(null);
    setCopied(false);

    const formData = new FormData(e.currentTarget);
    const input = {
      employer_name: formData.get('employer_name') as string,
      candidate_name: formData.get('candidate_name') as string,
      candidate_email: formData.get('candidate_email') as string,
      title: formData.get('title') as string,
      claimed_ctc: Number(formData.get('claimed_ctc')),
      employment_start: formData.get('employment_start') as string,
      employment_end: formData.get('employment_end') as string,
      uan: (formData.get('uan') as string) || undefined,
    };

    try {
      // createCase is a Server Action
      const result = await createCase(input);

      if (result.error) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.fields) {
          const errors: Record<string, string> = {};
          for (const field of result.error.details.fields) {
            errors[field.path] = field.message;
          }
          setFieldErrors(errors);
        } else {
          setGeneralError(result.error.message || 'Failed to create case');
        }
      } else {
        setSuccessLink(result.candidate_link);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setGeneralError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCopy = () => {
    if (successLink) {
      navigator.clipboard.writeText(successLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center">
        <button
          onClick={() => window.history.back()}
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] mr-2"
        >
          ← Cases
        </button>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-8">New verification</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
              Candidate name
            </label>
            <input
              type="text"
              name="candidate_name"
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.candidate_name ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.candidate_name && (
              <p className="mt-1 text-sm text-[var(--color-high)]">{fieldErrors.candidate_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
              Candidate email
            </label>
            <input
              type="email"
              name="candidate_email"
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.candidate_email ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.candidate_email && (
              <p className="mt-1 text-sm text-[var(--color-high)]">{fieldErrors.candidate_email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
              Claimed employer
            </label>
            <input
              type="text"
              name="employer_name"
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.employer_name ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.employer_name && (
              <p className="mt-1 text-sm text-[var(--color-high)]">{fieldErrors.employer_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
              Title
            </label>
            <input
              type="text"
              name="title"
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.title ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-sm text-[var(--color-high)]">{fieldErrors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
                Start date
              </label>
              <input
                type="date"
                name="employment_start"
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.employment_start ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.employment_start && (
                <p className="mt-1 text-sm text-[var(--color-high)]">
                  {fieldErrors.employment_start}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
                End date
              </label>
              <input
                type="date"
                name="employment_end"
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.employment_end ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.employment_end && (
                <p className="mt-1 text-sm text-[var(--color-high)]">
                  {fieldErrors.employment_end}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
                Claimed CTC (annual)
              </label>
              <input
                type="number"
                name="claimed_ctc"
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.claimed_ctc ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.claimed_ctc && (
                <p className="mt-1 text-sm text-[var(--color-high)]">{fieldErrors.claimed_ctc}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1">
                UAN (optional)
              </label>
              <input
                type="text"
                name="uan"
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.uan ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.uan && (
                <p className="mt-1 text-sm text-[var(--color-high)]">{fieldErrors.uan}</p>
              )}
            </div>
          </div>
        </div>

        {generalError && (
          <div className="rounded-[var(--radius-card)] bg-[var(--color-high-bg)] p-4 border border-[var(--color-high)]">
            <p className="text-sm text-[var(--color-high)]">{generalError}</p>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !!successLink}
            className="inline-flex justify-center rounded-[var(--radius-control)] border border-transparent bg-[var(--color-fg)] py-2 px-6 text-sm font-medium text-[var(--color-surface)] hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create and invite'}
          </button>
        </div>
      </form>

      {successLink && (
        <div className="mt-6 rounded-[var(--radius-card)] bg-[var(--color-ok-bg)] p-4 border border-[var(--color-ok)] flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-ok)] mb-1">
              Case created — candidate link
            </p>
            <p className="font-mono text-sm text-[var(--color-fg)]">{successLink}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              className="rounded-[var(--radius-control)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-page)] transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              className="rounded-[var(--radius-control)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-page)] disabled:opacity-50 transition-colors"
              disabled
            >
              QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
