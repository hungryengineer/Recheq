'use client';

import React, { useState, useEffect, use } from 'react';
import { Loader2, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

type StatusData = {
  status: string;
  documents_total: number;
  documents_extracted: number;
  steps?: Array<{
    id: string;
    label: string;
    state: string;
    started_at?: string;
    completed_at?: string;
  }>;
};

export default function CandidateStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/public/${token}/status`);
        if (!res.ok) {
          if (res.status === 410) {
            setError('This link has expired.');
            setPolling(false);
            return;
          }
          throw new Error('Failed to load status');
        }
        const json = await res.json();
        const body = json.data ?? json;
        if (!cancelled) {
          setData(body);
          // Stop polling once the case is complete
          if (body.status === 'complete') {
            setPolling(false);
          }
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }

      if (!cancelled && polling) {
        timer = setTimeout(poll, 3000);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, polling]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#050914] flex items-center justify-center p-4">
        <div className="bg-[#121826] border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Access Error</h2>
          <p className="text-sm text-[#94A3B8]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#050914] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const isProcessing = data.status === 'processing';
  const isComplete = data.status === 'complete';

  // The status endpoint returns status at top level; verdict is derived from the case record
  // We read the entire response to detect if verdict data is available

  return (
    <div className="min-h-screen bg-[#050914] text-white p-4 sm:p-6 md:p-8 font-sans flex flex-col items-center">
      <div className="w-full max-w-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20 shrink-0">
            R
          </div>
          <span className="font-semibold text-xl tracking-tight">Recheq</span>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="bg-[#121826] border border-[#1E293B] rounded-2xl p-8 sm:p-12 text-center">
            <div className="relative mx-auto w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-[#1E293B]" />
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold mb-3 tracking-tight">Verification in progress</h1>
            <p className="text-[#94A3B8] mb-8 max-w-md mx-auto">
              We&apos;re analyzing your documents and cross-referencing your employment details.
              This usually takes less than a minute.
            </p>

            {/* Step progress */}
            {data.steps && data.steps.length > 0 && (
              <div className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-5 text-left space-y-3">
                {data.steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3">
                    {step.state === 'succeeded' && (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {step.state === 'running' && (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                    )}
                    {step.state === 'pending' && (
                      <div className="w-4 h-4 rounded-full border-2 border-[#334155] shrink-0" />
                    )}
                    {step.state === 'failed' && (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    {step.state === 'skipped' && (
                      <div className="w-4 h-4 rounded-full bg-[#334155] shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        step.state === 'succeeded'
                          ? 'text-emerald-400'
                          : step.state === 'running'
                            ? 'text-blue-400'
                            : step.state === 'failed'
                              ? 'text-red-400'
                              : 'text-[#64748B]'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-[#64748B] mt-6">
              This page refreshes automatically. You can safely leave and come back.
            </p>
          </div>
        )}

        {/* Complete State */}
        {isComplete && (
          <div className="bg-[#121826] border border-[#1E293B] rounded-2xl p-8 sm:p-12 text-center">
            <div className="mx-auto mb-6 flex justify-center">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-semibold mb-3 tracking-tight">Verification Complete</h1>
            <p className="text-[#94A3B8] mb-2">
              Your background verification has been completed successfully.
            </p>
            <p className="text-sm text-[#64748B] mb-8">
              Your HR team has been notified and will review the results.
            </p>

            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-6">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-4 mb-4">
                <span className="text-sm text-[#94A3B8]">Documents analysed</span>
                <span className="text-sm font-medium text-white">{data.documents_total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94A3B8]">Status</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Complete
                </span>
              </div>
            </div>

            <p className="text-xs text-[#64748B] mt-8">
              You can safely close this page. Your HR team will follow up if needed.
            </p>
          </div>
        )}

        {/* Fallback for other states (awaiting_documents, etc.) */}
        {!isProcessing && !isComplete && (
          <div className="bg-[#121826] border border-[#1E293B] rounded-2xl p-8 sm:p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-semibold mb-3 tracking-tight">Submission Received</h1>
            <p className="text-[#94A3B8]">
              Your documents have been received and are queued for processing.
            </p>
            <p className="text-xs text-[#64748B] mt-6">This page refreshes automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
