'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';

export default function CandidateUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [payslipState, setPayslipState] = useState<'empty' | 'uploading' | 'uploaded' | 'failed'>(
    'empty',
  );
  const [payslipName, setPayslipName] = useState<string>('');
  const [payslipError, setPayslipError] = useState<string>('');

  const [form16State, setForm16State] = useState<'empty' | 'uploading' | 'uploaded' | 'failed'>(
    'empty',
  );
  const [form16Name, setForm16Name] = useState<string>('');
  const [form16Error, setForm16Error] = useState<string>('');

  const [uan, setUan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bothUploaded = payslipState === 'uploaded' && form16State === 'uploaded';

  const handleUpload = async (kind: 'payslip' | 'form_16', file: File) => {
    const setState = kind === 'payslip' ? setPayslipState : setForm16State;
    const setName = kind === 'payslip' ? setPayslipName : setForm16Name;
    const setError = kind === 'payslip' ? setPayslipError : setForm16Error;

    setState('uploading');
    setName(file.name);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', kind);

      // Hit Prism mock directly for now
      const res = await fetch(`/api/public/${token}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 413) throw new Error('File too large. Max 10MB.');
        if (res.status === 415) throw new Error('Unsupported file type. Use PDF or image.');
        throw new Error('Upload failed. Please try again.');
      }

      // 200 response (duplicate sha256) is success
      setState('uploaded');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
      setState('failed');
    }
  };

  const handleFileChange = (
    kind: 'payslip' | 'form_16',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(kind, file);
    }
    // reset input so the same file can be selected again if it failed
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bothUploaded) return;

    setIsSubmitting(true);
    try {
      if (uan) {
        await fetch(`/api/public/${token}/uan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uan }),
        });
      }

      await fetch(`/api/public/${token}/documents/submit`, { method: 'POST' });

      router.push(`/c/${token}/status`);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const renderCard = (
    title: string,
    state: 'empty' | 'uploading' | 'uploaded' | 'failed',
    name: string,
    errorMsg: string,
    kind: 'payslip' | 'form_16',
  ) => {
    const id = `file-${kind}`;

    if (state === 'empty') {
      return (
        <div className="border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-card)] p-5 text-center transition-colors hover:border-[var(--color-fg-subtle)] bg-[var(--color-surface)]">
          <label htmlFor={id} className="cursor-pointer flex flex-col items-center">
            <span className="text-[15px] font-medium text-[var(--color-fg)] mb-1">{title}</span>
            <span className="text-sm text-[var(--color-accent)] hover:underline mb-1">
              Choose a file
            </span>
            <span className="text-xs text-[var(--color-fg-subtle)]">PDF or image, max 10MB</span>
            <input
              type="file"
              id={id}
              className="sr-only"
              onChange={(e) => handleFileChange(kind, e)}
            />
          </label>
        </div>
      );
    }

    if (state === 'uploading') {
      return (
        <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] p-5 bg-[var(--color-surface)] flex flex-col justify-center">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[15px] font-medium text-[var(--color-fg)]">{title}</span>
            <span className="text-sm font-mono text-[var(--color-fg-muted)] truncate max-w-[150px]">
              {name}
            </span>
          </div>
          <div className="w-full bg-[var(--color-border)] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[var(--color-accent)] h-1.5 rounded-full w-1/2 animate-[pulse_1.5s_ease-in-out_infinite]" />
          </div>
          <div className="text-xs text-[var(--color-fg-subtle)] mt-2 text-right">Uploading...</div>
        </div>
      );
    }

    if (state === 'uploaded') {
      return (
        <div className="border border-[var(--color-ok)] rounded-[var(--radius-card)] p-5 bg-[var(--color-ok-bg)] flex flex-col justify-center">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[15px] font-medium text-[var(--color-fg)] block mb-1">
                {title}
              </span>
              <span className="text-[13px] font-mono text-[var(--color-fg-muted)]">{name}</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-[var(--color-ok)] flex items-center justify-center text-white text-xs">
              ✓
            </div>
          </div>
          <div className="text-sm font-medium text-[var(--color-ok)] mt-1">Uploaded</div>
        </div>
      );
    }

    if (state === 'failed') {
      return (
        <div className="border border-[var(--color-high)] rounded-[var(--radius-card)] p-5 bg-[var(--color-high-bg)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[15px] font-medium text-[var(--color-fg)]">{title}</span>
            <label
              htmlFor={id}
              className="text-sm font-medium text-[var(--color-high)] hover:underline cursor-pointer"
            >
              Retry
            </label>
            <input
              type="file"
              id={id}
              className="sr-only"
              onChange={(e) => handleFileChange(kind, e)}
            />
          </div>
          <div className="text-sm text-[var(--color-high)]">{errorMsg}</div>
        </div>
      );
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold text-[var(--color-fg)] mb-6">Recheq</h1>
      <h2 className="text-lg font-medium text-[var(--color-fg)] mb-6">Upload two documents</h2>

      <div className="space-y-4 mb-8">
        {renderCard('Payslip', payslipState, payslipName, payslipError, 'payslip')}
        {renderCard('Form 16', form16State, form16Name, form16Error, 'form_16')}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-fg-muted)] mb-2">
            UAN (optional)
          </label>
          <input
            type="text"
            value={uan}
            onChange={(e) => setUan(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-3 text-[var(--color-fg)] bg-[var(--color-surface)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="100123456789"
          />
        </div>

        <button
          type="submit"
          disabled={!bothUploaded || isSubmitting}
          className="w-full mb-2 flex justify-center py-3 px-4 border border-transparent rounded-[var(--radius-control)] shadow-sm text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] hover:opacity-90 disabled:opacity-50 disabled:bg-[var(--color-border)] disabled:text-[var(--color-fg-muted)] transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
        {!bothUploaded && (
          <p className="text-center text-sm text-[var(--color-fg-subtle)]">Both documents needed</p>
        )}
      </form>
    </div>
  );
}
