import React from 'react';

export default function SettingsPage() {
  return (
    <div className="py-6 animate-fade-in">
      <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-8">Settings</h1>
      <div className="bg-[var(--color-surface)] shadow-sm rounded-[var(--radius-card)] p-8 border border-[var(--color-border)] flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-[var(--color-fg-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-[var(--color-fg)]">Settings area under construction</h3>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">Configuration options will be available here soon.</p>
        </div>
      </div>
    </div>
  );
}
