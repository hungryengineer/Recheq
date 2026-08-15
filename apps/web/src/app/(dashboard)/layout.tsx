import Link from 'next/link';
import React from 'react';
import { ProfileDropdown } from '@/components/dashboard/ProfileDropdown';
import { HelpWidget } from '@/components/dashboard/HelpWidget';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-fg)] relative">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] relative z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-8">
            <Link
              href="/cases"
              className="text-lg font-semibold tracking-tight text-[var(--color-fg)]"
            >
              Recheq
            </Link>
            <nav className="flex space-x-6 text-sm">
              <Link href="/cases" className="font-medium text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors">
                Cases
              </Link>
              <Link href="/settings" className="font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center">
            <ProfileDropdown />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative z-0">{children}</main>
      
      {/* Fixed UI Elements */}
      <HelpWidget />
    </div>
  );
}
