'use client';

import { useState } from 'react';
import { submitUan } from '@/lib/api/candidate';

interface UanFormProps {
  token: string;
  onSuccess: () => void;
}

export function UanForm({ token, onSuccess }: UanFormProps) {
  const [uan, setUan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uan.length !== 12 || !/^\d+$/.test(uan)) {
      setError('UAN must be exactly 12 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await submitUan(token, uan);
      setSuccess(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mt-4">
      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>EPFO UAN (Optional)</h3>
      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
        Providing your Universal Account Number speeds up the verification process.
      </p>

      {success ? (
        <div style={{ color: 'var(--color-success)', fontWeight: 500 }}>✓ UAN Provided</div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="12-digit UAN"
            value={uan}
            onChange={(e) => setUan(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn-outline"
            style={{ width: 'auto' }}
          >
            {loading ? '...' : 'Save'}
          </button>
        </form>
      )}
      {error && (
        <p className="text-danger mt-2" style={{ fontSize: '0.875rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
