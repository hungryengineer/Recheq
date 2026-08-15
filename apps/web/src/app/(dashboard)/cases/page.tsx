import React from 'react';
import { getCases } from '../../../lib/api/cases';
import type { CaseSummary } from '@tieout/schema';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function Badge({ status, verdict }: { status?: string; verdict?: string | null }) {
  if (verdict) {
    switch (verdict) {
      case 'verified':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">
            {verdict.replace('_', ' ')}
          </span>
        );
      case 'verified_with_notes':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">
            {verdict.replace(/_/g, ' ')}
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-medium-bg)] text-[var(--color-medium)]">
            {verdict.replace('_', ' ')}
          </span>
        );
      case 'insufficient_evidence':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-high-bg)] text-[var(--color-high)]">
            {verdict.replace('_', ' ')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {verdict}
          </span>
        );
    }
  }
  if (status) {
    switch (status) {
      case 'complete':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[var(--color-fg-muted)]">
            {status}
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent-bg)] text-[var(--color-accent)]">
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[var(--color-fg-muted)]">
            {status.replace('_', ' ')}
          </span>
        );
    }
  }
  return null;
}

export default async function CasesPage() {
  const cases = await getCases();

  return (
    <div className="py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">Cases</h1>
        <Link
          href="/cases/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-[var(--radius-control)] shadow-sm text-sm font-medium text-white bg-[var(--color-fg)] hover:opacity-90 active:scale-95 transition-all"
        >
          + New case
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-card)]">
          <p className="text-sm text-[var(--color-fg-muted)] mb-4">No cases yet</p>
          <Link
            href="/cases/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-[var(--radius-control)] shadow-sm text-sm font-medium text-white bg-[var(--color-fg)] hover:opacity-90 active:scale-95 transition-all"
          >
            + New case
          </Link>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] shadow-sm rounded-[var(--radius-card)] overflow-hidden border border-[var(--color-border)]">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead className="bg-[var(--color-page)]">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider"
                >
                  Candidate
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider"
                >
                  Employer
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider"
                >
                  Verdict
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--color-border)]">
              {cases.map((c: CaseSummary) => (
                <tr key={c.id} className="hover:bg-[var(--color-page)] transition-colors relative group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/cases/${c.id}`}
                      className="text-sm font-medium text-[var(--color-fg)] hover:text-blue-600 focus:outline-none"
                    >
                      <span className="absolute inset-0 z-10" aria-hidden="true" />
                      {c.candidate_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-fg-muted)]">
                    {c.employer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge status={c.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap relative z-20">
                    {c.verdict ? (
                      <Badge verdict={c.verdict} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
