'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getCaseByToken, submitDocuments } from '@/lib/api/candidate';
import type { PublicCaseContext } from '@/lib/api/candidate';
import { DocumentUploader } from '@/components/candidate/DocumentUploader';
import { UanForm } from '@/components/candidate/UanForm';
import { WithdrawAction } from '@/components/candidate/WithdrawAction';

export default function CandidateUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [context, setContext] = useState<PublicCaseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCaseByToken(token)
      .then((data) => {
        if (data.status === 'awaiting_consent') {
          router.push(`/c/${token}`);
        } else if (data.status !== 'awaiting_documents') {
          router.push(`/c/${token}/status`);
        } else {
          setContext(data);
        }
      })
      .catch(() => router.push(`/c/${token}`))
      .finally(() => setLoading(false));
  }, [token, router]);

  const refreshContext = async () => {
    const data = await getCaseByToken(token);
    setContext(data);
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    try {
      await submitDocuments(token);
      router.push(`/c/${token}/status`);
    } catch {
      setSubmitting(false);
    }
  };

  if (loading || !context) {
    return <div className="container text-center mt-8"><p className="text-muted">Loading...</p></div>;
  }

  const allRequiredProvided = context.documentsRequired.every(doc => context.documentsProvided.includes(doc));

  return (
    <div className="container animate-fade-in">
      <div className="text-center mb-6">
        <h1 style={{ fontSize: '1.75rem', color: 'var(--color-primary)' }}>Upload Documents</h1>
        <p className="mt-2 text-muted">Please provide the required documents below.</p>
      </div>

      <DocumentUploader 
        token={token} 
        kind="payslip" 
        label="Recent Payslip" 
        onSuccess={refreshContext} 
      />
      
      <DocumentUploader 
        token={token} 
        kind="form_16" 
        label="Form 16" 
        onSuccess={refreshContext} 
      />

      <UanForm token={token} onSuccess={refreshContext} />

      <div className="mt-8">
        <button 
          onClick={handleSubmitAll} 
          disabled={!allRequiredProvided || submitting}
          className="btn btn-primary"
        >
          {submitting ? 'Submitting...' : 'Complete & Submit'}
        </button>
        {!allRequiredProvided && (
          <p className="text-center text-muted mt-2" style={{ fontSize: '0.875rem' }}>
            You must upload all required documents to proceed.
          </p>
        )}
      </div>

      <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
        <WithdrawAction token={token} />
      </div>
    </div>
  );
}
