import React from 'react';
import Link from 'next/link';
import { getCaseDetails } from '@/lib/api/cases';
import { FindingCard } from '@/components/dashboard/FindingCard';
import { EditCaseButton } from '@/components/dashboard/EditCaseButton';
import type {} from '@/components/dashboard/FindingCard';
import type { CaseRecord, FindingRecord } from '@recheq/schema';

interface PageProps {
  params: Promise<{ id: string }>;
}

function Badge({ verdict }: { verdict?: string | null }) {
  if (!verdict) return null;
  switch (verdict) {
    case 'verified':
    case 'verified_with_notes':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">
          {verdict.replace(/_/g, ' ')}
        </span>
      );
    case 'needs_review':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-medium-bg)] text-[var(--color-medium)]">
          {verdict.replace(/_/g, ' ')}
        </span>
      );
    case 'insufficient_evidence':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-high-bg)] text-[var(--color-high)]">
          {verdict.replace(/_/g, ' ')}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[var(--color-fg-muted)]">
          {verdict.replace(/_/g, ' ')}
        </span>
      );
  }
}

export default async function CaseDetailsPage({ params }: PageProps) {
  const { id } = await params;

  let caseRecord: CaseRecord | null = null;
  let findings: FindingRecord[] = [];
  let notAssessed: string[] = [];
  let origins: string[] = [];

  try {
    const data = await getCaseDetails(id);
    if (!data.found) {
      throw new Error('Not found');
    }
    caseRecord = data.caseRecord;
    findings = data.findings;
    notAssessed = data.notAssessed;
    origins = data.origins;
  } catch {
    return (
      <div className="py-20 text-center animate-fade-in">
        <h2 className="text-xl font-semibold text-[var(--color-high)] mb-2">Failed to load case</h2>
        <Link href="/cases" className="text-[var(--color-accent)] hover:underline font-medium">
          &larr; Return to Dashboard
        </Link>
      </div>
    );
  }

  if (!caseRecord) {
    return (
      <div className="py-20 text-center animate-fade-in">
        <h2 className="text-xl font-semibold text-[var(--color-high)] mb-2">Case not found</h2>
        <Link href="/cases" className="text-[var(--color-accent)] hover:underline font-medium">
          &larr; Return to Dashboard
        </Link>
      </div>
    );
  }

  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  return (
    <div className="animate-fade-in pb-12">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/cases"
            className="text-[13px] text-[var(--color-accent)] hover:underline font-medium"
          >
            &larr; Back to cases
          </Link>
          <span className="text-[10px] text-[var(--color-fg-subtle)] font-mono tracking-wide">
            {id}
          </span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[22px] font-semibold text-[var(--color-fg)] leading-tight">
              {caseRecord.candidate_name}
            </h1>
            <p className="text-[13px] text-[var(--color-fg-muted)] mt-1">
              {caseRecord.title} at {caseRecord.employer_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {caseRecord.verdict && <Badge verdict={caseRecord.verdict} />}
            <EditCaseButton caseRecord={caseRecord} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4 shadow-sm flex flex-col justify-between">
          <div className="text-sm font-medium text-[var(--color-fg-muted)] mb-2">Risk score</div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-[var(--color-fg)]">
              {caseRecord.risk_score ?? '-'}
            </span>
            {caseRecord.risk_score !== null && (
              <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">
                {caseRecord.risk_score === 100 && findings.length === 0
                  ? 'Unverified Default'
                  : `40x${highCount} high + 15x${mediumCount} med`}
              </span>
            )}
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4 shadow-sm flex flex-col justify-between">
          <div className="text-sm font-medium text-[var(--color-fg-muted)] mb-2">High severity</div>
          <div className="text-3xl font-semibold text-[var(--color-high)]">{highCount}</div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4 shadow-sm flex flex-col justify-between">
          <div className="text-sm font-medium text-[var(--color-fg-muted)] mb-2">
            Medium severity
          </div>
          <div className="text-3xl font-semibold text-[var(--color-medium)]">{mediumCount}</div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4 shadow-sm flex flex-col justify-between">
          <div className="text-sm font-medium text-[var(--color-fg-muted)] mb-2">
            Independent sources
          </div>
          <div className="text-3xl font-semibold text-[var(--color-fg)]">{origins.length}</div>
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-10">
        <span className="text-sm font-medium text-[var(--color-fg-muted)] mr-2">
          Evidence sources
        </span>
        {['payslip', 'form16', 'epfo'].map((source) => {
          const hasSource = origins.includes(source);
          if (hasSource) {
            return (
              <span
                key={source}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]"
              >
                ✓{' '}
                {source === 'form16' ? 'Form 16' : source.charAt(0).toUpperCase() + source.slice(1)}
              </span>
            );
          }
          return null;
        })}
        {!origins.includes('employer') && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-[var(--color-fg-subtle)]">
            Employer pending
          </span>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--color-fg)] mb-4 border-b border-[var(--color-border)] pb-2">
          Discrepancy ledger
        </h2>

        {findings.length === 0 ? (
          <div className="text-sm text-[var(--color-fg-muted)] py-4">No findings.</div>
        ) : (
          <div className="space-y-4 mb-6">
            {findings.map((f, i) => (
              <FindingCard key={i} finding={f} caseId={id} />
            ))}
          </div>
        )}

        {notAssessed.length > 0 && (
          <div className="bg-[var(--color-page)] rounded-[var(--radius-card)] border border-[var(--color-border)] p-4 flex flex-col sm:flex-row sm:items-center">
            <span className="text-[13px] font-medium text-[var(--color-fg-muted)] mr-4 whitespace-nowrap mb-2 sm:mb-0">
              Not assessed &mdash; {notAssessed.length} rules
            </span>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
              {notAssessed.map((rule) => (
                <span key={rule}>· {rule}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
