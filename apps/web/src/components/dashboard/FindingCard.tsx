'use client';

import React, { useState } from 'react';
import { getFriendlyRuleTitle } from '@/lib/rule-display';
import { FileText } from 'lucide-react';
import { DocumentViewer } from './DocumentViewer';

export interface UI_Finding {
  rule_id: string;
  severity: string;
  explanation: string;
  expected: string | number;
  observed: string | number;
  source_label?: string;
  source_document_ids?: string[];
}

export function FindingCard({ finding, caseId }: { finding: UI_Finding; caseId: string }) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const severityColor =
    finding.severity === 'high'
      ? 'var(--color-high)'
      : finding.severity === 'medium'
        ? 'var(--color-medium)'
        : 'var(--color-fg-muted)';
  const severityBg =
    finding.severity === 'high'
      ? 'var(--color-high-bg)'
      : finding.severity === 'medium'
        ? 'var(--color-medium-bg)'
        : 'var(--color-page)';

  return (
    <>
      <div
        className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-sm border overflow-hidden"
        style={{ borderColor: severityColor }}
      >
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center space-x-3">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: severityBg, color: severityColor }}
              >
                {finding.severity}
              </span>
              <h3 className="text-[14px] font-medium text-[var(--color-fg)]">
                {getFriendlyRuleTitle(finding.rule_id as string)}
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">
              {finding.rule_id}
            </span>
          </div>

          <p className="text-[12px] text-[var(--color-fg-muted)] mb-4">{finding.explanation}</p>

          <div className="flex justify-between items-end">
            <div className="flex space-x-8">
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-[var(--color-fg-subtle)] mb-1 uppercase">
                  Expected
                </div>
                <div className="font-mono text-[13px] text-[var(--color-fg)]">
                  {finding.expected}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-[var(--color-fg-subtle)] mb-1 uppercase">
                  Observed
                </div>
                <div className="font-mono text-[13px] font-medium" style={{ color: severityColor }}>
                  {finding.observed}
                </div>
              </div>
            </div>

            {finding.source_label && (
              <button
                onClick={() => setIsViewerOpen(true)}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1 active:scale-95 transition-all focus:outline-none"
              >
                <FileText className="w-3 h-3" />
                {finding.source_label}
              </button>
            )}
          </div>
        </div>
      </div>

      {isViewerOpen && (
        <DocumentViewer
          sourceLabel={finding.source_label || 'Unknown'}
          caseId={caseId}
          docId={finding.source_document_ids?.[0] || 'unknown'}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </>
  );
}
