import React from 'react';

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-[500px] rounded-[var(--radius-card)] p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
