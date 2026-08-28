import React from 'react';

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CandidateConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const apiUrl = process.env.API_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';

  const res = await fetch(`${apiUrl}/api/public/${token}`, { cache: 'no-store' });

  if (!res.ok) {
    if (res.status === 410) {
      return (
        <div className="animate-fade-in text-center mt-12">
          <div className="bg-[var(--color-high-bg)] p-6 rounded-[var(--radius-card)] border border-[var(--color-high)] inline-block">
            <h2 className="text-lg font-semibold text-[var(--color-high)] mb-2">Access Denied</h2>
            <p className="text-sm text-[var(--color-fg)]">
              This link has expired - ask your recruiter for a new one
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-fade-in text-center mt-12">
        <div className="bg-[var(--color-high-bg)] p-6 rounded-[var(--radius-card)] border border-[var(--color-high)] inline-block">
          <h2 className="text-lg font-semibold text-[var(--color-high)] mb-2">Access Denied</h2>
          <p className="text-sm text-[var(--color-fg)]">This link isn't valid</p>
        </div>
      </div>
    );
  }

  const context = await res.json();

  if (context.status === 'awaiting_documents') {
    redirect(`/c/${token}/upload`);
  } else if (
    context.status === 'processing' ||
    context.status === 'complete' ||
    context.status === 'withdrawn'
  ) {
    redirect(`/c/${token}/status`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-[500px] rounded-[var(--radius-card)] p-8 shadow-sm">
        <div className="animate-fade-in">
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-[var(--color-fg)] mb-2">Recheq</h1>
            <p className="text-[17px] text-[var(--color-fg)] leading-snug">
              {context.org_name} has asked us to verify your employment at {context.employer_name}.
            </p>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-sm overflow-hidden mb-8">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-[var(--color-fg)] mb-3">
                What we'll collect
              </h2>
              <ul className="space-y-2 text-sm text-[var(--color-fg-muted)]">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Your payslip</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Your Form 16</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>EPFO contribution history via your UAN</span>
                </li>
              </ul>
            </div>

            <div className="border-t border-[var(--color-border)] px-5 py-4 bg-[var(--color-page)]">
              <dl className="space-y-3 text-sm">
                <div className="grid grid-cols-4 gap-4">
                  <dt className="font-medium text-[var(--color-fg-subtle)]">Why</dt>
                  <dd className="col-span-3 text-[var(--color-fg)]">
                    Employment verification only
                  </dd>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <dt className="font-medium text-[var(--color-fg-subtle)]">Kept</dt>
                  <dd className="col-span-3 text-[var(--color-fg)]">180 days, then deleted</dd>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <dt className="font-medium text-[var(--color-fg-subtle)]">Where</dt>
                  <dd className="col-span-3 text-[var(--color-fg)]">
                    India; documents are read by an AI model hosted outside India
                  </dd>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <dt className="font-medium text-[var(--color-fg-subtle)]">Rights</dt>
                  <dd className="col-span-3 text-[var(--color-fg)]">Withdraw anytime</dd>
                </div>
              </dl>
            </div>
          </div>

          <form
            action={async () => {
              'use server';
              // Mocking the POST action for now until FE-6 rewrites it properly via client
              const api = process.env.API_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
              const res = await fetch(`${api}/api/public/${token}/consent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  consent_text: 'I consent to employment verification and data processing as outlined.',
                  consent_version: 'v1.0',
                }),
              });
              
              if (!res.ok) {
                console.error('Consent request failed:', await res.text());
                throw new Error('Failed to record consent');
              }
              
              redirect(`/c/${token}/upload`);
            }}
          >
            <button
              type="submit"
              className="w-full mb-3 flex justify-center py-3 px-4 border border-transparent rounded-[var(--radius-control)] shadow-sm text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] hover:opacity-90"
            >
              I consent
            </button>
          </form>

          <form
            action={async () => {
              'use server';
              // Mocking the DELETE action
              const api = process.env.API_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
              await fetch(`${api}/api/public/${token}/consent`, { method: 'DELETE' });
              redirect(`/c/${token}/status`);
            }}
          >
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 rounded-[var(--radius-control)] text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            >
              Decline
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
