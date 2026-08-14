'use client';

import { useEffect, useState, use } from 'react';
import { getCaseByToken } from '@/lib/api/candidate';
import type { PublicCaseContext } from '@/lib/api/candidate';
import { ConsentSummary } from '@/components/candidate/ConsentSummary';
import { ConsentAction } from '@/components/candidate/ConsentAction';
import { useRouter } from 'next/navigation';

export default function CandidateConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [context, setContext] = useState<PublicCaseContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCaseByToken(token)
      .then((data) => {
        if (
          data.status === 'awaiting_documents' ||
          data.status === 'processing' ||
          data.status === 'complete'
        ) {
          // Already consented, redirect to status or upload
          if (data.status === 'awaiting_documents') {
            router.push(`/c/${token}/upload`);
          } else {
            router.push(`/c/${token}/status`);
          }
        } else if (data.status === 'withdrawn') {
          router.push(`/c/${token}/status`);
        } else {
          setContext(data);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [token, router]);

  if (loading) {
    return (
      <div className="container text-center mt-8 animate-fade-in">
        <p className="text-muted">Loading your secure link...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-8 animate-fade-in">
        <div className="card text-center" style={{ borderColor: 'var(--color-danger)' }}>
          <h2 className="text-danger">Access Denied</h2>
          <p className="mt-2 text-muted">
            {error === 'TOKEN_EXPIRED'
              ? 'This link has expired for your security. Please request a new link from your employer.'
              : 'This link is invalid or could not be verified.'}
          </p>
        </div>
      </div>
    );
  }

  if (!context) return null;

  return (
    <div className="container animate-fade-in">
      <div className="text-center">
        <h1 style={{ fontSize: '1.75rem', color: 'var(--color-primary)' }}>
          {context.orgName} Background Verification
        </h1>
        <p className="mt-2 text-muted" style={{ fontSize: '1.1rem' }}>
          Hello {context.candidateName}, please review and provide your consent to begin the
          verification process.
        </p>
      </div>

      <ConsentSummary orgName={context.orgName} />
      <ConsentAction token={token} />
    </div>
  );
}
