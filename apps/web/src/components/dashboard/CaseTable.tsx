import React from 'react';
import Link from 'next/link';
import type { CaseSummary } from '@tieout/schema';
import { CaseStatusBadge } from './CaseStatusBadge';

interface CaseTableProps {
  cases: CaseSummary[];
}

export function CaseTable({ cases }: CaseTableProps) {
  if (!cases || cases.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-900">No cases found</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new case.</p>
        <div className="mt-6">
          <Link
            href="/cases/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Create New Case
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
            >
              Candidate
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Employer / Title
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Created
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Status & Verdict
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {cases.map((c) => (
            <tr key={c.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                {c.candidate_name}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                <div className="font-medium text-gray-900">{c.employer_name}</div>
                <div>{c.title}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                <div className="flex flex-col space-y-1 items-start">
                  <CaseStatusBadge status={c.status} />
                  {c.verdict && <CaseStatusBadge verdict={c.verdict} />}
                </div>
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <Link href={`/cases/${c.id}`} className="text-blue-600 hover:text-blue-900">
                  View<span className="sr-only">, {c.candidate_name}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
