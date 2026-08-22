'use client';

import React, { useState } from 'react';
import { createCase } from '../../lib/api/actions';
import { isCreateCaseError } from '../../lib/api/actions-types';
import { CaseCreateInput } from '@tieout/schema';
import { QRCodeSVG } from 'qrcode.react';
import { X, QrCode } from 'lucide-react';

export function CreateCaseForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

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

    // Client-side validation (KAN-64)
    const parsed = CaseCreateInput.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      setIsSubmitting(false);

      // Accessibility focus on first invalid field
      if (parsed.error.issues.length > 0) {
        const firstField = parsed.error.issues[0].path[0];
        const element = document.getElementById(String(firstField));
        if (element) element.focus();
      }
      return;
    }

    try {
      // createCase is a Server Action
      const result = await createCase(parsed.data);

      if (isCreateCaseError(result)) {
        const { error } = result;
        if (error.code === 'VALIDATION_ERROR' && error.details?.fields) {
          const errors: Record<string, string> = {};
          for (const field of error.details.fields) {
            errors[field.path] = field.message;
          }
          setFieldErrors(errors);
        } else {
          setGeneralError(error.message ?? 'Failed to create case');
        }
      } else {
        setSuccessLink(result.candidate_link ?? null);
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
            <label
              htmlFor="candidate_name"
              className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
            >
              Candidate name
            </label>
            <input
              type="text"
              id="candidate_name"
              name="candidate_name"
              aria-describedby={fieldErrors.candidate_name ? 'candidate_name-error' : undefined}
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.candidate_name ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.candidate_name && (
              <p id="candidate_name-error" className="mt-1 text-sm text-[var(--color-high)]">
                {fieldErrors.candidate_name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="candidate_email"
              className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
            >
              Candidate email
            </label>
            <input
              type="email"
              id="candidate_email"
              name="candidate_email"
              aria-describedby={fieldErrors.candidate_email ? 'candidate_email-error' : undefined}
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.candidate_email ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.candidate_email && (
              <p id="candidate_email-error" className="mt-1 text-sm text-[var(--color-high)]">
                {fieldErrors.candidate_email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="employer_name"
              className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
            >
              Claimed employer
            </label>
            <input
              type="text"
              id="employer_name"
              name="employer_name"
              aria-describedby={fieldErrors.employer_name ? 'employer_name-error' : undefined}
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.employer_name ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.employer_name && (
              <p id="employer_name-error" className="mt-1 text-sm text-[var(--color-high)]">
                {fieldErrors.employer_name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
            >
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
              className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.title ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
            />
            {fieldErrors.title && (
              <p id="title-error" className="mt-1 text-sm text-[var(--color-high)]">
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="employment_start"
                className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
              >
                Start date
              </label>
              <input
                type="date"
                id="employment_start"
                name="employment_start"
                aria-describedby={
                  fieldErrors.employment_start ? 'employment_start-error' : undefined
                }
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.employment_start ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.employment_start && (
                <p id="employment_start-error" className="mt-1 text-sm text-[var(--color-high)]">
                  {fieldErrors.employment_start}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="employment_end"
                className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
              >
                End date
              </label>
              <input
                type="date"
                id="employment_end"
                name="employment_end"
                aria-describedby={fieldErrors.employment_end ? 'employment_end-error' : undefined}
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.employment_end ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.employment_end && (
                <p id="employment_end-error" className="mt-1 text-sm text-[var(--color-high)]">
                  {fieldErrors.employment_end}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="claimed_ctc"
                className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
              >
                Claimed CTC (annual)
              </label>
              <input
                type="number"
                id="claimed_ctc"
                name="claimed_ctc"
                aria-describedby={fieldErrors.claimed_ctc ? 'claimed_ctc-error' : undefined}
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.claimed_ctc ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.claimed_ctc && (
                <p id="claimed_ctc-error" className="mt-1 text-sm text-[var(--color-high)]">
                  {fieldErrors.claimed_ctc}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="uan"
                className="block text-sm font-medium text-[var(--color-fg-muted)] mb-1"
              >
                UAN (optional)
              </label>
              <input
                type="text"
                id="uan"
                name="uan"
                aria-describedby={fieldErrors.uan ? 'uan-error' : undefined}
                className={`w-full rounded-[var(--radius-control)] border ${fieldErrors.uan ? 'border-[var(--color-high)]' : 'border-[var(--color-border)]'} px-3 py-2 text-[var(--color-fg)] bg-[var(--color-surface)]`}
              />
              {fieldErrors.uan && (
                <p id="uan-error" className="mt-1 text-sm text-[var(--color-high)]">
                  {fieldErrors.uan}
                </p>
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
              onClick={() => setIsQrModalOpen(true)}
              className="rounded-[var(--radius-control)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-page)] transition-colors flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" /> QR
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {isQrModalOpen && successLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"></div>

            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-page)] rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6 mt-2">
              <h3 className="text-xl font-bold text-[var(--color-fg)] mb-2">Scan to verify</h3>
              <p className="text-sm text-[var(--color-fg-muted)]">
                Ask the candidate to scan this QR code with their mobile device to begin the
                verification journey.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-100 mb-6 relative">
              <QRCodeSVG
                value={successLink}
                size={220}
                level="Q"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>",
                  x: undefined,
                  y: undefined,
                  height: 48,
                  width: 48,
                  excavate: true,
                }}
              />
            </div>

            <button
              onClick={handleCopy}
              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2.5 rounded-[var(--radius-control)] transition-colors text-sm"
            >
              {copied ? 'Link Copied!' : 'Copy Link Instead'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
