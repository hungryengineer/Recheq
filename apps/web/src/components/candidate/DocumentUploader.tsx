'use client';

import { useState } from 'react';
import type { DocumentKind } from '@tieout/schema';
import { uploadDocument } from '@/lib/api/candidate';

interface DocumentUploaderProps {
  token: string;
  kind: DocumentKind;
  label: string;
  onSuccess: () => void;
}

export function DocumentUploader({ token, kind, label, onSuccess }: DocumentUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await uploadDocument(token, kind, file);
      setSuccess(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mt-4">
      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{label}</h3>
      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
        Please upload a clear PDF or image. Max size 10MB.
      </p>

      {success ? (
        <div style={{ color: 'var(--color-success)', fontWeight: 500 }}>
          ✓ Uploaded successfully
        </div>
      ) : (
        <div>
          <input 
            type="file" 
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={loading}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
          />
          {loading && <p className="text-muted mt-2">Uploading...</p>}
          {error && <p className="text-danger mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
