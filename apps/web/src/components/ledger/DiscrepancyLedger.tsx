import React from 'react';
import type { FindingRecord } from '@tieout/schema';
import { FindingCard } from './FindingCard';
import { RiskScore } from './RiskScore';
import { NotAssessedList } from './NotAssessedList';

interface DiscrepancyLedgerProps {
  findings: FindingRecord[];
  notAssessed: string[];
  riskScore: number | null;
}

export function DiscrepancyLedger({ findings, notAssessed, riskScore }: DiscrepancyLedgerProps) {
  // Sort findings by severity (high -> medium -> low)
  const severityRank = { high: 0, medium: 1, low: 2 };
  const sortedFindings = [...findings].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <RiskScore score={riskScore} />
        </div>

        <div className="md:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-semibold leading-6 text-gray-900 mb-4">Findings Ledger</h2>

            {sortedFindings.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
                <p className="text-sm text-gray-500">No findings reported for this case.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedFindings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            )}
          </div>

          <NotAssessedList rules={notAssessed} />
        </div>
      </div>
    </div>
  );
}
