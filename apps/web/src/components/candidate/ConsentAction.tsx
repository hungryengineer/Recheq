'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { grantConsent } from '@/lib/api/candidate';

export function ConsentAction({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConsent = async () => {
    setLoading(true);
    setError(null);
    try {
      // In a real implementation we would collect IP and User Agent server-side, 
      // but we pass dummy values to match the signature.
      await grantConsent(token, '127.0.0.1', navigator.userAgent);
      router.push(`/c/${token}/upload`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 text-center animate-fade-in">
      <p style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
        By clicking below, you agree to the processing of your data as described above.
      </p>
      <button 
        onClick={handleConsent} 
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? 'Processing...' : 'I Consent & Agree'}
      </button>
      {error && (
        <p className="text-danger mt-4" style={{ fontSize: '0.875rem' }}>{error}</p>
      )}
    </div>
  );
}
