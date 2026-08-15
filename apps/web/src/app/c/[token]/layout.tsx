import React from 'react';

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-fg)] py-12 px-4 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-md">{children}</main>
    </div>
  );
}
