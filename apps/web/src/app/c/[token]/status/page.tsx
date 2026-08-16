'use client';

import React, { useEffect, useState, use } from 'react';

interface Step {
  key: string;
  label: string;
  state: 'pending' | 'active' | 'done' | 'failed';
}

interface StatusResponse {
  status: string;
  documents_total: number;
  documents_extracted: number;
  steps: Step[];
  error?: {
    code: string;
    message: string;
  };
}

export default function CandidateStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const [data, setData] = useState<StatusResponse | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let active = true;
    const intervalId = setInterval(async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/public/${token}/status`);
        if (!res.ok) return;
        const json: StatusResponse = await res.json();
        if (active) setData(json);

        if (json.status === 'complete' || json.status === 'withdrawn') {
          if (active) setIsComplete(true);
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 2000);

    fetch(`/api/public/${token}/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json) return;
        setData(json);
        if (json.status === 'complete' || json.status === 'withdrawn') {
          setIsComplete(true);
          clearInterval(intervalId);
        }
      })
      .catch((err) => console.error('Initial poll error', err));

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [token]);

  if (isComplete) {
    return (
      <div className="animate-fade-in text-center py-12">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--color-ok-bg)] flex items-center justify-center mb-6">
          <span className="text-3xl text-[var(--color-ok)]">✓</span>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-2">Submission complete</h1>
        <p className="text-[var(--color-fg-muted)] mb-6">
          Thank you. Your background verification documents have been securely submitted.
        </p>

        {data?.error && (
          <div className="text-sm bg-gray-50 border border-gray-200 rounded p-4 text-gray-600 inline-block text-left mb-6">
            <span className="font-semibold block mb-1">Note:</span>
            {data.error.message}
          </div>
        )}

        <p className="text-sm text-[var(--color-fg-subtle)]">You can safely close this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold text-[var(--color-fg)] mb-6">Recheq</h1>
      <h2 className="text-lg font-medium text-[var(--color-fg)] mb-8">Checking your documents</h2>

      <div className="space-y-6 mb-12 ml-2">
        {data ? (
          data.steps.map((step) => (
            <div key={step.key} className="flex items-center">
              <div className="mr-4 flex-shrink-0">
                {step.state === 'done' && (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-ok-bg)] flex items-center justify-center">
                    <span className="text-[var(--color-ok)] text-xs">✓</span>
                  </div>
                )}
                {step.state === 'active' && (
                  <div className="w-5 h-5 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
                )}
                {step.state === 'pending' && <div className="w-5 h-5 rounded-full bg-gray-200" />}
              </div>
              <span
                className={`text-[15px] font-medium ${
                  step.state === 'active'
                    ? 'text-[var(--color-fg)]'
                    : step.state === 'done'
                      ? 'text-[var(--color-fg-muted)]'
                      : 'text-[var(--color-fg-subtle)]'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-[var(--color-fg-muted)]">Connecting...</div>
        )}
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-5 shadow-sm">
        <p className="text-[14px] text-[var(--color-fg)] mb-1 font-medium">
          Usually under 90 seconds.
        </p>
        <p className="text-[14px] text-[var(--color-fg-muted)]">Keep this page open.</p>
        <p className="text-[12px] font-mono text-[var(--color-fg-subtle)] mt-4 pt-4 border-t border-[var(--color-border)]">
          Polls GET /api/public/:token/status every 2s. Named steps, never a bare spinner.
        </p>
      </div>
    </div>
  );
}
