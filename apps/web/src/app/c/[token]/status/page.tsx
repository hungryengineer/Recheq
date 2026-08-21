'use client';

import React, { useEffect, useState, use } from 'react';

interface Step {
  id: string;
  label: string;
  state:
    | 'pending'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'timed_out'
    | 'not_assessed'
    | 'awaiting_external';
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
  const [terminalStatus, setTerminalStatus] = useState<'complete' | 'withdrawn' | null>(null);
  const [pollInterval, setPollInterval] = useState(2000);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setPollInterval(document.visibilityState === 'hidden' ? 10000 : 2000);
    };
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (terminalStatus) return;

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/public/${token}/status`);
        if (!res.ok) throw new Error('Network error');
        const json: StatusResponse = await res.json();
        if (active) setData(json);

        if (json.status === 'complete' || json.status === 'withdrawn') {
          if (active) setTerminalStatus(json.status as 'complete' | 'withdrawn');
          return;
        }
      } catch (err) {
        console.error('Polling error', err);
      }

      if (active) {
        timeoutId = setTimeout(poll, pollInterval);
      }
    };

    poll();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [token, pollInterval, terminalStatus]);

  const renderStepIcon = (state: Step['state']) => {
    switch (state) {
      case 'succeeded':
        return (
          <div className="w-5 h-5 rounded-full bg-[var(--color-ok-bg)] flex items-center justify-center">
            <span className="text-[var(--color-ok)] text-xs">✓</span>
          </div>
        );
      case 'running':
        return (
          <div className="w-5 h-5 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
        );
      case 'failed':
      case 'timed_out':
        return (
          <div className="w-5 h-5 rounded-full bg-[var(--color-high-bg)] flex items-center justify-center">
            <span className="text-[var(--color-high)] text-xs">✕</span>
          </div>
        );
      case 'not_assessed':
        return (
          <div className="w-5 h-5 flex items-center justify-center">
            <span className="text-[var(--color-fg-muted)] text-xs">—</span>
          </div>
        );
      case 'awaiting_external':
        return (
          <div className="w-5 h-5 rounded-full bg-[var(--color-medium-bg)] flex items-center justify-center">
            <span className="text-[var(--color-medium)] text-xs">◷</span>
          </div>
        );
      case 'pending':
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-200" />;
    }
  };

  const getStepTextColor = (state: Step['state']) => {
    switch (state) {
      case 'running':
        return 'text-[var(--color-fg)]';
      case 'succeeded':
      case 'not_assessed':
        return 'text-[var(--color-fg-muted)]';
      case 'failed':
      case 'timed_out':
        return 'text-[var(--color-high)]';
      case 'awaiting_external':
        return 'text-[var(--color-medium)]';
      case 'pending':
      default:
        return 'text-[var(--color-fg-subtle)]';
    }
  };

  if (terminalStatus && data) {
    if (terminalStatus === 'withdrawn') {
      return (
        <div className="animate-fade-in text-center py-12">
          <div className="mx-auto w-16 h-16 flex items-center justify-center mb-6">
            <span className="text-4xl text-[var(--color-fg-muted)]">—</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-2">
            Verification withdrawn
          </h1>
          <p className="text-[var(--color-fg-muted)] mb-6">
            Your background verification has been withdrawn.
          </p>
          <p className="text-sm text-[var(--color-fg-subtle)]">You can safely close this page.</p>
        </div>
      );
    }

    const allNotAssessed =
      data.steps && data.steps.length > 0 && data.steps.every((s) => s.state === 'not_assessed');
    const hasAwaitingExternal =
      data.steps && data.steps.some((s) => s.state === 'awaiting_external');

    if (allNotAssessed) {
      return (
        <div className="animate-fade-in text-center py-12">
          <div className="mx-auto w-16 h-16 flex items-center justify-center mb-6">
            <span className="text-4xl text-[var(--color-fg-muted)]">—</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-2">
            Verification limited
          </h1>
          <p className="text-[var(--color-fg-muted)] mb-6">
            We could not verify enough information from the provided documents.
          </p>
          <p className="text-sm text-[var(--color-fg-subtle)]">You can safely close this page.</p>
        </div>
      );
    }

    return (
      <div className="animate-fade-in text-center py-12">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--color-ok-bg)] flex items-center justify-center mb-6">
          <span className="text-3xl text-[var(--color-ok)]">✓</span>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-2">Submission complete</h1>
        <p className="text-[var(--color-fg-muted)] mb-6">
          Thank you. Your background verification documents have been securely submitted.
        </p>

        {hasAwaitingExternal && (
          <div className="text-sm bg-[var(--color-medium-bg)] border border-transparent rounded p-4 text-[var(--color-medium)] inline-block text-left mb-6">
            <span className="font-semibold block mb-1">Waiting on your previous employer</span>
            The interim verdict is already usable.
          </div>
        )}

        {data.error && (
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
          data.steps?.map((step, index) => (
            <div key={step.id ? `${step.id}-${index}` : index} className="flex items-center">
              <div className="mr-4 flex-shrink-0">{renderStepIcon(step.state)}</div>
              <span className={`text-[15px] font-medium ${getStepTextColor(step.state)}`}>
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
      </div>
    </div>
  );
}
