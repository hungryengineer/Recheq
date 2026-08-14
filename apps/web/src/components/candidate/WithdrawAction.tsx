'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { withdrawConsent } from '@/lib/api/candidate';

export function WithdrawAction({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleWithdraw = async () => {
    setLoading(true);
    try {
      await withdrawConsent(token);
      router.push(`/c/${token}/status`);
    } catch {
      setLoading(false);
    }
  };

  if (confirming) {
    return (
      <div className="card text-center" style={{ borderColor: 'var(--color-danger)' }}>
        <h3 className="text-danger" style={{ fontSize: '1.1rem' }}>Are you sure?</h3>
        <p className="text-muted mt-2" style={{ fontSize: '0.875rem' }}>
          This will permanently delete your uploaded documents and cancel the background check. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => setConfirming(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="btn btn-danger" 
            onClick={handleWithdraw}
            disabled={loading}
          >
            {loading ? 'Withdrawing...' : 'Yes, Withdraw'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <button 
        className="btn btn-outline" 
        onClick={() => setConfirming(true)}
        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
      >
        Withdraw Consent
      </button>
      <p className="text-muted mt-2" style={{ fontSize: '0.75rem' }}>
        You can withdraw from the verification process at any time.
      </p>
    </div>
  );
}
