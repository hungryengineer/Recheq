import React from 'react';

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CandidateConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const apiUrl =
    process.env.API_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');

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
  const status = context.data?.status;

  if (status === 'awaiting_consent' || status === 'awaiting_documents') {
    // Consent is now handled inline on step 1 of the upload flow
    redirect(`/c/${token}/upload`);
  } else {
    // Catch-all for awaiting_employer, processing, complete, withdrawn, etc.
    redirect(`/c/${token}/status`);
  }
}
