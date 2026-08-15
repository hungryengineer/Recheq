import React from 'react';
import type { CaseStatus, Verdict } from '@tieout/schema';

interface CaseStatusBadgeProps {
  status?: CaseStatus;
  verdict?: Verdict | null;
}

export function CaseStatusBadge({ status, verdict }: CaseStatusBadgeProps) {
  if (verdict) {
    const verdictConfig: Record<Verdict, { color: string; label: string }> = {
      verified: { color: 'bg-green-100 text-green-800', label: 'Verified' },
      verified_with_notes: { color: 'bg-blue-100 text-blue-800', label: 'Verified w/ Notes' },
      needs_review: { color: 'bg-yellow-100 text-yellow-800', label: 'Needs Review' },
      insufficient_evidence: { color: 'bg-red-100 text-red-800', label: 'Insufficient Evidence' },
    };
    
    const config = verdictConfig[verdict];
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  }

  if (status) {
    const statusConfig: Record<CaseStatus, { color: string; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      awaiting_consent: { color: 'bg-gray-100 text-gray-800', label: 'Awaiting Consent' },
      awaiting_documents: { color: 'bg-gray-100 text-gray-800', label: 'Awaiting Documents' },
      processing: { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
      awaiting_employer: { color: 'bg-yellow-100 text-yellow-800', label: 'Awaiting Employer' },
      complete: { color: 'bg-green-100 text-green-800', label: 'Complete' },
      withdrawn: { color: 'bg-red-100 text-red-800', label: 'Withdrawn' },
      error: { color: 'bg-red-100 text-red-800', label: 'Error' },
    };

    const config = statusConfig[status];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  }

  return null;
}
