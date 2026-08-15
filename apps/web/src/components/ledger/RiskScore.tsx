import React from 'react';

interface RiskScoreProps {
  score: number | null;
}

export function RiskScore({ score }: RiskScoreProps) {
  if (score === null) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Risk Score</h3>
        <p className="mt-2 text-sm text-gray-500">
          Not available. The case is likely still processing or lacks sufficient evidence.
        </p>
      </div>
    );
  }

  let colorClass = 'text-green-600 bg-green-50 border-green-200';
  if (score > 30) colorClass = 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (score > 60) colorClass = 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className={`rounded-lg p-6 border ${colorClass}`}>
      <h3 className="text-lg font-medium opacity-90">Risk Score</h3>
      <div className="mt-2 flex items-baseline gap-x-2">
        <span className="text-5xl font-bold tracking-tight">{score}</span>
        <span className="text-sm opacity-80">/ 100</span>
      </div>
      <p className="mt-4 text-sm opacity-80 border-t border-current pt-4">
        Arithmetic Breakdown:{' '}
        <span className="font-mono">min(100, 40×high + 15×medium + 5×low)</span>
      </p>
    </div>
  );
}
