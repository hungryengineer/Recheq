import React from 'react';
import { getCases } from '../../../lib/api/cases';
import { CaseTable } from '@/components/dashboard/CaseTable';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CasesPage() {
  const cases = await getCases();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold leading-6 text-gray-900">Background Check Cases</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all candidate verification cases in your organization including their status
            and verdicts.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            href="/cases/new"
            className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Create New Case
          </Link>
        </div>
      </div>
      <div className="mt-8 flow-root">
        <CaseTable cases={cases} />
      </div>
    </div>
  );
}
