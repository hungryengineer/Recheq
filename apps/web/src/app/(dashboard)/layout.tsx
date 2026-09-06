import Link from 'next/link';
import React from 'react';
import { ProfileDropdown } from '@/components/dashboard/ProfileDropdown';
import { HelpWidget } from '@/components/dashboard/HelpWidget';
import { UserProvider } from '@/contexts/UserContext';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@recheq/api/src/security/session.js';
import { getDb } from '@/lib/server/db';
import { schema } from '@recheq/api/src/db/client.js';
import { eq } from 'drizzle-orm';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;

  let initialUser = undefined;

  if (token) {
    const payload = await verifySessionToken(getDb(), token);
    if (payload?.userId) {
      const db = getDb();
      const userRes = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.userId))
        .limit(1);
      if (userRes.length > 0) {
        const user = userRes[0];
        const orgRes = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, user.org_id))
          .limit(1);
        const org = orgRes[0];

        initialUser = {
          name: user.name,
          email: user.email,
          companyName: org?.name || 'Unknown Company',
          avatar: user.avatar,
        };
      }
    }
  }

  return (
    <UserProvider initialUser={initialUser}>
      <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-fg)] relative">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] relative z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-8">
              <Link href="/cases" className="flex items-center gap-3">
                <img src="/logo-icon-light.png" alt="Recheq Logo" className="w-12 h-12 object-contain scale-[1.4]" />
                <span className="text-lg font-semibold tracking-tight text-[var(--color-fg)]">
                  Recheq
                </span>
              </Link>
              <nav className="flex space-x-6 text-sm">
                <Link
                  href="/cases"
                  className="font-medium text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
                >
                  Cases
                </Link>
                <Link
                  href="/settings"
                  className="font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
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
    </UserProvider>
  );
}
