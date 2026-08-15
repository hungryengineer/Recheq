import React from 'react';
import type { FindingRecord } from '@tieout/schema';
import { SourceBadge } from './SourceBadge';
import { DisputeStatus } from './DisputeStatus';
import { DisputeForm } from '../candidate/DisputeForm';

interface FindingCardProps {
  finding: FindingRecord;
  candidateToken?: string;
}

export function FindingCard({ finding, candidateToken }: FindingCardProps) {
  const borderColors = {
    high: 'border-red-500',
    medium: 'border-yellow-500',
    low: 'border-blue-500',
  };
  const bgColors = {
    high: 'bg-red-50',
    medium: 'bg-yellow-50',
    low: 'bg-blue-50',
  };

  return (
    <div
      className={`overflow-hidden rounded-lg bg-white shadow border-l-4 ${borderColors[finding.severity]}`}
    >
      <div
        className={`px-4 py-3 sm:px-6 flex justify-between items-center border-b border-gray-200 ${bgColors[finding.severity]}`}
      >
        <div>
          <h3 className="text-base font-semibold leading-6 text-gray-900 capitalize">
            {finding.title}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {finding.rule_id} &middot; {finding.severity} Severity &middot; {finding.status}
          </p>
        </div>
        <div className="flex gap-2">
          {finding.source_document_ids.map((id) => (
            <SourceBadge key={id} sourceId={id} />
          ))}
        </div>
      </div>
      <div className="px-4 py-5 sm:p-6 text-sm text-gray-700">
        <p className="mb-4">{finding.explanation}</p>

        {(finding.expected || finding.observed) && (
          <div className="bg-gray-50 p-4 rounded-md font-mono text-xs border border-gray-200 grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="block text-gray-500 mb-1 font-sans font-medium uppercase tracking-wider text-[10px]">
                Expected
              </span>
              {finding.expected || <span className="text-gray-400 italic">null</span>}
            </div>
            <div>
              <span className="block text-gray-500 mb-1 font-sans font-medium uppercase tracking-wider text-[10px]">
                Observed
              </span>
              {finding.observed || <span className="text-gray-400 italic">null</span>}
            </div>
          </div>
        )}

        <DisputeStatus finding={finding} />

        {candidateToken && finding.status === 'open' && (
          <DisputeForm token={candidateToken} findingId={finding.id} />
        )}
      </div>
    </div>
  );
}
