'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getCaseByToken } from '@/lib/api/candidate';
import type { PublicCaseContext } from '@/lib/api/candidate';
import { ProcessingStatus } from '@/components/candidate/ProcessingStatus';

export default function CandidateStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [context, setContext] = useState<PublicCaseContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Poll the status every 3 seconds if we are in processing state
    const fetchStatus = async () => {
      try {
        const data = await getCaseByToken(token);
        if (data.status === 'awaiting_consent') {
          router.push(`/c/${token}`);
        } else if (data.status === 'awaiting_documents') {
          router.push(`/c/${token}/upload`);
        } else {
          setContext(data);
        }
      } catch {
        router.push(`/c/${token}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [token, router]);

  if (loading || !context) {
    return <div className="container text-center mt-8"><p className="text-muted">Loading...</p></div>;
  }

  return (
    <div className="container animate-fade-in">
      <div className="text-center mb-6">
        <h1 style={{ fontSize: '1.75rem', color: 'var(--color-primary)' }}>Status</h1>
      </div>
      
      <ProcessingStatus status={context.status} />
      
      <div className="mt-8 text-center">
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>
          If you have any questions, please contact {context.employerName}.
        </p>
      </div>
    </div>
  );
}
