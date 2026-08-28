'use client';

import React from 'react';

export default function CandidateStatusPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-[500px] rounded-[var(--radius-card)] p-8 shadow-sm">
        <div className="animate-fade-in text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-[var(--color-ok-bg)] flex items-center justify-center mb-6">
            <span className="text-3xl text-[var(--color-ok)]">✓</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-2">
            Successfully submitted your form
          </h1>
          <p className="text-[var(--color-fg-muted)] mb-6">Waiting review from your HR team.</p>

          <p className="text-sm text-[var(--color-fg-subtle)]">You can safely close this page.</p>
        </div>
      </div>
    </div>
  );
}
