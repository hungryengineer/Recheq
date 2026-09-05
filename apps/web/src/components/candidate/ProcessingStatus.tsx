'use client';

import type { CaseStatus } from '@recheq/schema';

export function ProcessingStatus({ status }: { status: CaseStatus }) {
  if (status === 'withdrawn') {
    return (
      <div className="card text-center mt-6" style={{ borderColor: 'var(--color-danger)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛑</div>
        <h2 className="text-danger">Consent Withdrawn</h2>
        <p className="text-muted mt-2">
          Your background verification process has been cancelled and your documents have been
          securely deleted.
        </p>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="card text-center mt-6">
        <div
          style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}
        >
          ⏳
        </div>
        <h2 style={{ color: 'var(--color-primary)' }}>Processing Documents</h2>
        <p className="text-muted mt-2">
          We are currently verifying your documents. You can close this window. Your employer will
          contact you with the final results.
        </p>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (status === 'complete' || status === 'awaiting_employer') {
    return (
      <div className="card text-center mt-6" style={{ borderColor: 'var(--color-success)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ color: 'var(--color-success)' }}>Verification Complete</h2>
        <p className="text-muted mt-2">
          Your documents have been processed successfully. Your employer has been notified.
        </p>
      </div>
    );
  }

  return null;
}
