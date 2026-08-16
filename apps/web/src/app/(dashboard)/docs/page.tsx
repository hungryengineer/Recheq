'use client';

import React from 'react';
import { Book, Shield, Code, Server, Terminal, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 animate-fade-in">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--color-fg)] mb-2">Platform Documentation</h1>
        <p className="text-lg text-[var(--color-fg-muted)]">
          Everything you need to know about the Recheq architecture, patterns, and coding standards.
        </p>
      </div>

      <div className="space-y-12">
        {/* Section: Core Concepts */}
        <section>
          <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-border)] pb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
              <Book size={20} />
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-fg)]">Core Concepts</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-xl shadow-sm">
              <h3 className="font-medium text-[var(--color-fg)] mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                Cases
              </h3>
              <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
                A Case represents a single candidate undergoing background verification. It
                aggregates multiple findings, discrepancy scores, and a final verdict.
              </p>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-xl shadow-sm">
              <h3 className="font-medium text-[var(--color-fg)] mb-2 flex items-center gap-2">
                <Shield size={16} className="text-indigo-500" />
                Findings
              </h3>
              <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
                Individual data discrepancies flagged by the rule engine (e.g., "Salary mismatch").
                Findings have a severity (High/Medium/Low) and map to specific source documents.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Architecture */}
        <section>
          <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-border)] pb-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
              <Server size={20} />
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-fg)]">Architecture Overview</h2>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 space-y-4 text-sm text-[var(--color-fg-muted)] leading-relaxed">
              <p>
                Recheq uses a modern{' '}
                <strong className="text-[var(--color-fg)] font-medium">Turborepo Monorepo</strong>{' '}
                structure to share schemas and configurations between the Frontend and Backend.
              </p>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Code size={16} className="text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <strong className="text-[var(--color-fg)] block mb-0.5">
                      Frontend (Next.js App Router)
                    </strong>
                    Located in <code>apps/web</code>. We utilize React Server Components for data
                    fetching and Server Actions for mutations (e.g., <code>loginAction</code>,{' '}
                    <code>signupAction</code>).
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Terminal size={16} className="text-gray-500" />
                  </div>
                  <div>
                    <strong className="text-[var(--color-fg)] block mb-0.5">
                      Mock API (Stoplight Prism)
                    </strong>
                    Currently, the backend is mocked using Prism running on port <code>4010</code>.
                    It serves responses directly defined in <code>contract/openapi.yaml</code>.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section: Coding Standards */}
        <section>
          <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-border)] pb-2">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
              <Code size={20} />
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-fg)]">
              Strict Coding Standards (AGENTS.md)
            </h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30">
              <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-500 mb-1">
                Zero-Trust & Validation
              </h4>
              <p className="text-xs text-yellow-700 dark:text-yellow-600/80">
                Never use type assertions (<code>as unknown as X</code>). Always enforce runtime
                validation using strict Zod schemas.{' '}
                <strong>
                  No <code>any</code> types allowed.
                </strong>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
              <h4 className="text-sm font-bold text-blue-800 dark:text-blue-500 mb-1">
                Data Integrity
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-600/80">
                When updating critical records, preserve cryptographic hash chains using the{' '}
                <code>AuditService</code>. Anticipate race conditions and utilize proper PostgreSQL
                locking.
              </p>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <div className="mt-8 pt-8 border-t border-[var(--color-border)] flex justify-between items-center">
          <p className="text-sm text-[var(--color-fg-subtle)]">
            Need more help? Check the OpenAPI contract.
          </p>
          <Link
            href="/cases"
            className="text-sm font-medium text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
          >
            Back to Dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
