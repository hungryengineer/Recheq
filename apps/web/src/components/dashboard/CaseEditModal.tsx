'use client';

import React, { useState } from 'react';
import { updateCase } from '@/lib/api/actions';
import { isUpdateCaseError } from '@/lib/api/actions-types';
import { CaseUpdateInput, type CaseRecord } from '@recheq/schema';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CaseEditModalProps {
  caseRecord: CaseRecord;
  onClose: () => void;
}

export function CaseEditModal({ caseRecord, onClose }: CaseEditModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setGeneralError(null);

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
    const parsed = CaseUpdateInput.safeParse(input);
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
      const result = await updateCase(caseRecord.id, parsed.data);

      if (result && typeof result === 'object' && isUpdateCaseError(result)) {
        const { error } = result;
        if (error.code === 'VALIDATION_ERROR' && error.details?.fields) {
          const errors: Record<string, string> = {};
          for (const field of error.details.fields) {
            errors[field.path] = field.message;
          }
          setFieldErrors(errors);
        } else {
          setGeneralError(error.message ?? 'Failed to update case');
        }
      } else {
        router.refresh();
        onClose();
      }
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      setGeneralError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--color-fg)]">
            Edit Case Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {generalError && (
            <div
              className="mb-6 p-4 rounded-md bg-[var(--color-high-bg)] border border-[var(--color-high)] border-opacity-20 text-[var(--color-high)] text-sm"
              role="alert"
            >
              {generalError}
            </div>
          )}

          <form id="edit-case-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="candidate_name"
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  Candidate Name <span className="text-[var(--color-high)]">*</span>
                </label>
                <input
                  type="text"
                  id="candidate_name"
                  name="candidate_name"
                  required
                  defaultValue={caseRecord.candidate_name}
                  aria-invalid={!!fieldErrors.candidate_name}
                  aria-describedby={fieldErrors.candidate_name ? 'candidate_name-error' : undefined}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
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
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  Candidate Email <span className="text-[var(--color-high)]">*</span>
                </label>
                <input
                  type="email"
                  id="candidate_email"
                  name="candidate_email"
                  required
                  defaultValue={caseRecord.candidate_email}
                  aria-invalid={!!fieldErrors.candidate_email}
                  aria-describedby={
                    fieldErrors.candidate_email ? 'candidate_email-error' : undefined
                  }
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
                />
                {fieldErrors.candidate_email && (
                  <p id="candidate_email-error" className="mt-1 text-sm text-[var(--color-high)]">
                    {fieldErrors.candidate_email}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  Case Title / Role <span className="text-[var(--color-high)]">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  defaultValue={caseRecord.title}
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
                />
                {fieldErrors.title && (
                  <p id="title-error" className="mt-1 text-sm text-[var(--color-high)]">
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="employer_name"
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  Employer Name <span className="text-[var(--color-high)]">*</span>
                </label>
                <input
                  type="text"
                  id="employer_name"
                  name="employer_name"
                  required
                  defaultValue={caseRecord.employer_name}
                  aria-invalid={!!fieldErrors.employer_name}
                  aria-describedby={fieldErrors.employer_name ? 'employer_name-error' : undefined}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
                />
                {fieldErrors.employer_name && (
                  <p id="employer_name-error" className="mt-1 text-sm text-[var(--color-high)]">
                    {fieldErrors.employer_name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="employment_start"
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  Start Date <span className="text-[var(--color-high)]">*</span>
                </label>
                <input
                  type="date"
                  id="employment_start"
                  name="employment_start"
                  required
                  defaultValue={caseRecord.employment_start}
                  aria-invalid={!!fieldErrors.employment_start}
                  aria-describedby={
                    fieldErrors.employment_start ? 'employment_start-error' : undefined
                  }
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
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
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  End Date <span className="text-[var(--color-high)]">*</span>
                </label>
                <input
                  type="date"
                  id="employment_end"
                  name="employment_end"
                  required
                  defaultValue={caseRecord.employment_end}
                  aria-invalid={!!fieldErrors.employment_end}
                  aria-describedby={fieldErrors.employment_end ? 'employment_end-error' : undefined}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
                />
                {fieldErrors.employment_end && (
                  <p id="employment_end-error" className="mt-1 text-sm text-[var(--color-high)]">
                    {fieldErrors.employment_end}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="claimed_ctc"
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  Claimed CTC (INR) <span className="text-[var(--color-high)]">*</span>
                </label>
                <input
                  type="number"
                  id="claimed_ctc"
                  name="claimed_ctc"
                  min="0"
                  required
                  defaultValue={caseRecord.claimed_ctc}
                  aria-invalid={!!fieldErrors.claimed_ctc}
                  aria-describedby={fieldErrors.claimed_ctc ? 'claimed_ctc-error' : undefined}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
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
                  className="block text-sm font-medium text-[var(--color-fg)] mb-1"
                >
                  UAN (Optional)
                </label>
                <input
                  type="text"
                  id="uan"
                  name="uan"
                  defaultValue={caseRecord.uan || ''}
                  aria-invalid={!!fieldErrors.uan}
                  aria-describedby={fieldErrors.uan ? 'uan-error' : undefined}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] bg-[var(--color-page)] text-[var(--color-fg)]"
                />
                {fieldErrors.uan && (
                  <p id="uan-error" className="mt-1 text-sm text-[var(--color-high)]">
                    {fieldErrors.uan}
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-[var(--color-fg-muted)] bg-transparent border border-[var(--color-border)] rounded-md hover:text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-case-form"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] border border-transparent rounded-md hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)] disabled:opacity-50 flex items-center justify-center"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
