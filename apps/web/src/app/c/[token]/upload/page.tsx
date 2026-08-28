'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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

      const res = await fetch(`/api/public/${token}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 413) throw new Error('File too large. Max 10MB.');
        if (res.status === 415) throw new Error('Unsupported file type. Use PDF or image.');
        throw new Error('Upload failed. Please try again.');
      }

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

      await fetch(`/api/public/${token}/submit`, { method: 'POST' });
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
        <div className="bg-[#121826] border border-[#1E293B] rounded-xl p-6 text-center transition-all hover:border-[#334155]">
          <label htmlFor={id} className="cursor-pointer flex flex-col items-center">
            <span className="text-sm font-medium text-white mb-2">{title}</span>
            <span className="text-[13px] text-blue-400 mb-1.5">Choose a file</span>
            <span className="text-[11px] text-[#64748B]">PDF or image, max 10MB</span>
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
        <div className="bg-[#121826] border border-[#1E293B] rounded-xl p-6 flex flex-col justify-center text-center">
          <div className="text-sm font-medium text-white mb-2">{title}</div>
          <div className="flex items-center justify-center gap-2 text-[13px] text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
          </div>
          <div className="text-[11px] text-[#64748B] mt-1.5 truncate max-w-full px-4">{name}</div>
        </div>
      );
    }

    if (state === 'uploaded') {
      return (
        <div className="bg-[#0F1C1B] border border-[#14432A] rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <div className="text-sm font-medium text-white mb-2">{title}</div>
          <div className="text-[13px] text-emerald-400 flex items-center justify-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              ✓
            </div>
            Uploaded
          </div>
          <div className="text-[11px] text-emerald-500/70 mt-1.5 truncate max-w-full px-4">
            {name}
          </div>
        </div>
      );
    }

    if (state === 'failed') {
      return (
        <div className="bg-[#1C1215] border border-[#43141F] rounded-xl p-6 text-center">
          <label htmlFor={id} className="cursor-pointer flex flex-col items-center">
            <span className="text-sm font-medium text-white mb-2">{title}</span>
            <span className="text-[13px] text-red-400 hover:underline mb-1.5">Retry Upload</span>
            <span className="text-[11px] text-red-500/70 truncate px-4">{errorMsg}</span>
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
  };

  return (
    <div className="min-h-screen bg-[#050914] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#B4B8C0] rounded-xl p-8 shadow-2xl animate-fade-in relative overflow-hidden">
        <h1 className="text-white text-lg font-semibold mb-6">Recheq</h1>
        <h2 className="text-white text-sm mb-6">Upload two documents</h2>

        <div className="space-y-4 mb-6">
          {renderCard('Payslip', payslipState, payslipName, payslipError, 'payslip')}
          {renderCard('Form 16', form16State, form16Name, form16Error, 'form_16')}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-[13px] text-[#74889E] mb-2 font-medium">
              UAN (optional)
            </label>
            <input
              type="text"
              value={uan}
              onChange={(e) => setUan(e.target.value)}
              className="w-full rounded-lg border-none px-4 py-3 text-white bg-[#121826] placeholder:text-[#334155] focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-sm"
              placeholder="100123456789"
            />
          </div>

          <button
            type="submit"
            disabled={!bothUploaded || isSubmitting}
            className="w-full mb-3 flex justify-center items-center py-3 px-4 rounded-lg text-sm font-medium text-[#E2E8F0] bg-[#64748B] hover:bg-[#475569] disabled:bg-[#8391A2] disabled:opacity-80 transition-colors"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
          {!bothUploaded && (
            <p className="text-center text-xs text-[#5C6A7B]">Both documents needed</p>
          )}
        </form>
      </div>
    </div>
  );
}
