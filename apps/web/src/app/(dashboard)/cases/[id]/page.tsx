import React from 'react';
import { getCaseDetails } from '../../../../lib/api/cases';
import { CaseStatusBadge } from '../../../../components/dashboard/CaseStatusBadge';
import { DiscrepancyLedger } from '../../../../components/ledger/DiscrepancyLedger';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailsPage({ params }: PageProps) {
  // Next.js 16/React 19 dynamic params handling
  const { id } = await params;

  try {
    const { caseRecord, findings, notAssessed } = await getCaseDetails(id);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <Link href="/cases" className="text-sm text-blue-600 hover:text-blue-800">
                  &larr; Back to Cases
                </Link>
                <div className="h-4 w-px bg-gray-300"></div>
                <span className="text-sm text-gray-500 font-mono">{caseRecord.id}</span>
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
                {caseRecord.candidate_name}
              </h1>
              <p className="mt-1 text-lg text-gray-500">
                {caseRecord.title} at {caseRecord.employer_name}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <CaseStatusBadge status={caseRecord.status} />
              {caseRecord.verdict && <CaseStatusBadge verdict={caseRecord.verdict} />}
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-8">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Claimed CTC</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  ₹{caseRecord.claimed_ctc.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Employment Dates</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {caseRecord.employment_start} to {caseRecord.employment_end}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">UAN</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {caseRecord.uan || <span className="text-gray-400 italic">Not provided</span>}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-12">
          <DiscrepancyLedger
            findings={findings}
            notAssessed={notAssessed}
            riskScore={caseRecord.risk_score}
          />
        </div>
      </div>
    );
  } catch (err) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Case Not Found</h2>
        <p className="text-gray-500 mb-6">
          The case you are looking for does not exist or you do not have permission to view it.
        </p>
        <Link href="/cases" className="text-blue-600 hover:text-blue-800 font-medium">
          Return to Dashboard
        </Link>
      </div>
    );
  }
}
