import Link from 'next/link';
import React from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-8">
            <Link
              href="/cases"
              className="text-lg font-semibold tracking-tight text-[var(--color-fg)]"
            >
              Recheq
            </Link>
            <nav className="flex space-x-6 text-sm">
              <Link href="/cases" className="font-medium text-[var(--color-fg)] hover:text-blue-600 transition-colors">
                Cases
              </Link>
              <Link href="/settings" className="font-medium text-[var(--color-fg-muted)] hover:text-blue-600 transition-colors">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-bg)] text-sm font-medium text-[var(--color-accent)]">
              PR
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
