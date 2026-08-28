'use client';

import React, { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, FileText } from 'lucide-react';
import { CaseUpdateInput } from '@tieout/schema';

type CaseData = {
  candidateName: string;
  employerName: string;
  title: string;
  claimed_ctc?: number;
  employment_start?: string;
  employment_end?: string;
  uan?: string;
};

export default function CandidateUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseData>({
    candidateName: '',
    employerName: '',
    title: '',
  });

  const [formData, setFormData] = useState({
    candidate_name: '',
    employer_name: '',
    title: '',
    employment_start: '',
    employment_end: '',
    claimed_ctc: '',
    uan: '',
  });

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const bothUploaded = payslipState === 'uploaded' && form16State === 'uploaded';

  useEffect(() => {
    fetch(`/api/public/${token}/candidate`)
      .then((res) => res.json())
      .then((data) => {
        setCaseData(data);
        setFormData({
          candidate_name: data.candidateName || '',
          employer_name: data.employerName || '',
          title: data.title || '',
          employment_start: data.employment_start || '',
          employment_end: data.employment_end || '',
          claimed_ctc: data.claimed_ctc ? String(data.claimed_ctc) : '',
          uan: data.uan || '',
        });
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpload = async (kind: 'payslip' | 'form_16', file: File) => {
    const setState = kind === 'payslip' ? setPayslipState : setForm16State;
    const setName = kind === 'payslip' ? setPayslipName : setForm16Name;
    const setError = kind === 'payslip' ? setPayslipError : setForm16Error;

    setState('uploading');
    setName(file.name);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);

      const res = await fetch(`/api/public/${token}/documents`, {
        method: 'POST',
        body: fd,
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
    if (file) handleUpload(kind, file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bothUploaded) return;

    setFormError('');
    setIsSubmitting(true);

    try {
      const payload: Partial<CaseUpdateInput> = {};
      if (formData.candidate_name) payload.candidate_name = formData.candidate_name;
      if (formData.employer_name) payload.employer_name = formData.employer_name;
      if (formData.title) payload.title = formData.title;
      if (formData.employment_start) payload.employment_start = formData.employment_start;
      if (formData.employment_end) payload.employment_end = formData.employment_end;
      if (formData.claimed_ctc) payload.claimed_ctc = Number(formData.claimed_ctc);
      if (formData.uan) payload.uan = formData.uan;

      if (
        !payload.candidate_name ||
        !payload.employer_name ||
        !payload.employment_start ||
        !payload.employment_end ||
        !payload.claimed_ctc
      ) {
        throw new Error('Please fill all mandatory fields in Verification details.');
      }

      if (formData.uan) {
        await fetch(`/api/public/${token}/uan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uan: formData.uan }),
        });
      }

      const res = await fetch(`/api/public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to submit case');
      }

      router.push(`/c/${token}/status`);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  const renderCard = (
    title: string,
    subtitle: string,
    state: 'empty' | 'uploading' | 'uploaded' | 'failed',
    name: string,
    errorMsg: string,
    kind: 'payslip' | 'form_16',
  ) => {
    const id = `file-${kind}`;

    if (state === 'empty') {
      return (
        <div className="bg-[#121826] border border-[#1E293B] rounded-xl p-5 flex items-center justify-between transition-colors hover:border-[#334155]">
          <div>
            <div className="text-sm font-medium text-white mb-1">{title}</div>
            <div className="text-xs text-[#64748B]">{subtitle}</div>
          </div>
          <label
            htmlFor={id}
            className="cursor-pointer border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-[#94A3B8] text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Choose file
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
        <div className="bg-[#121826] border border-[#1E293B] rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white mb-1">{title}</div>
            <div className="text-xs text-blue-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
            </div>
          </div>
          <div className="text-xs text-[#64748B] truncate max-w-[150px]">{name}</div>
        </div>
      );
    }

    if (state === 'uploaded') {
      return (
        <div className="bg-[#0F1C1B] border border-[#14432A] rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white mb-1">{title}</div>
            <div className="text-xs text-emerald-400 flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">
                ✓
              </div>
              Uploaded successfully
            </div>
          </div>
          <div className="text-xs text-emerald-500/70 truncate max-w-[150px]">{name}</div>
        </div>
      );
    }

    if (state === 'failed') {
      return (
        <div className="bg-[#1C1215] border border-[#43141F] rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white mb-1">{title}</div>
            <div className="text-xs text-red-400">{errorMsg}</div>
          </div>
          <label
            htmlFor={id}
            className="cursor-pointer border border-[#43141F] bg-[#2A0F15] hover:bg-[#43141F] text-red-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Retry
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050914] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050914] text-white p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
            R
          </div>
          <span className="font-semibold text-lg">Recheq</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">New verification</h1>
          <p className="text-sm text-[#94A3B8]">
            Fill in the details below to initiate a new verification request.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#121826] border border-[#1E293B] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded bg-[#1E293B] flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="font-medium text-[15px]">Verification details</h2>
                    <p className="text-xs text-[#94A3B8]">
                      Please provide the candidate and employment details.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      Candidate name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="candidate_name"
                      value={formData.candidate_name}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      Claimed employer <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="employer_name"
                      value={formData.employer_name}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Enter employer name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      Title / Designation <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Enter job title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      UAN (optional)
                    </label>
                    <input
                      type="text"
                      name="uan"
                      value={formData.uan}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Enter UAN (12 digits)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      Start date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="employment_start"
                      value={formData.employment_start}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-[#94A3B8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      End date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="employment_end"
                      value={formData.employment_end}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-[#94A3B8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      Claimed CTC (annual) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="claimed_ctc"
                      value={formData.claimed_ctc}
                      onChange={handleInputChange}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Enter amount"
                    />
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3 flex items-center gap-2 mb-6 text-xs text-[#94A3B8]">
                  <span className="text-blue-400">ⓘ</span> All fields marked with{' '}
                  <span className="text-red-500 mx-1">*</span> are mandatory
                </div>
              </div>

              <div className="bg-[#121826] border border-[#1E293B] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                    👤
                  </div>
                  <div>
                    <h2 className="font-medium text-[15px]">Your profile</h2>
                    <p className="text-xs text-[#94A3B8]">
                      You are completing this verification request
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#0B0F19] rounded-xl p-4 border border-[#1E293B]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center font-medium text-lg">
                      {caseData.candidateName
                        ? caseData.candidateName.charAt(0).toUpperCase()
                        : 'C'}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {caseData.candidateName || 'Candidate'}
                      </div>
                      <div className="text-xs text-[#64748B]">Completing verification</div>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg border border-[#1E293B] text-xs text-[#94A3B8]">
                    Candidate
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#121826] border border-[#1E293B] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded bg-[#1E293B] flex items-center justify-center">
                    <Upload className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="font-medium text-[15px]">Upload documents</h2>
                    <p className="text-xs text-[#94A3B8]">
                      Upload both of the following documents.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {renderCard(
                    'Payslip',
                    'Upload recent payslip',
                    payslipState,
                    payslipName,
                    payslipError,
                    'payslip',
                  )}
                  {renderCard(
                    'Form 16',
                    'Upload Form 16 document',
                    form16State,
                    form16Name,
                    form16Error,
                    'form_16',
                  )}
                </div>

                {formError && (
                  <div className="mb-4 text-xs text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!bothUploaded || isSubmitting}
                  className="w-full py-3 rounded-lg text-sm font-medium transition-colors mb-3 flex items-center justify-center disabled:opacity-50
                    bg-[#4F46E5] hover:bg-[#4338CA] text-white disabled:bg-[#1E293B] disabled:text-[#64748B]"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit verification
                </button>
                {!bothUploaded && (
                  <div className="text-center text-xs text-[#64748B] flex items-center justify-center gap-1.5">
                    <span>🔒</span> Both documents are required to submit
                  </div>
                )}
              </div>

              <div className="bg-[#121826] border border-[#1E293B] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded bg-[#1E293B] flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-400 opacity-80" />
                  </div>
                  <div>
                    <h2 className="font-medium text-[15px]">Candidate summary</h2>
                    <p className="text-xs text-[#94A3B8]">Review candidate information</p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-[#1E293B] pb-2">
                    <span className="text-[#94A3B8]">Candidate name</span>
                    <span className="font-medium text-white truncate max-w-[150px]">
                      {formData.candidate_name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1E293B] pb-2">
                    <span className="text-[#94A3B8]">Employer</span>
                    <span className="font-medium text-white truncate max-w-[150px]">
                      {formData.employer_name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1E293B] pb-2">
                    <span className="text-[#94A3B8]">Designation</span>
                    <span className="font-medium text-white truncate max-w-[150px]">
                      {formData.title || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1E293B] pb-2">
                    <span className="text-[#94A3B8]">CTC (annual)</span>
                    <span className="font-medium text-white">
                      {formData.claimed_ctc
                        ? `₹${Number(formData.claimed_ctc).toLocaleString('en-IN')}`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
