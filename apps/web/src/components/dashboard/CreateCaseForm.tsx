'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CaseCreateInput } from '@tieout/schema';
import { createCase } from '../../lib/api/cases';

export function CreateCaseForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const input: CaseCreateInput = {
      employer_name: formData.get('employer_name') as string,
      candidate_name: formData.get('candidate_name') as string,
      title: formData.get('title') as string,
      claimed_ctc: Number(formData.get('claimed_ctc')),
      employment_start: formData.get('employment_start') as string,
      employment_end: formData.get('employment_end') as string,
      uan: (formData.get('uan') as string) || null,
    };

    try {
      const newCase = await createCase(input);
      router.push(`/cases/${newCase.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create case');
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6"
    >
      <div className="md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Case Information</h3>
          <p className="mt-1 text-sm text-gray-500">
            Provide the details of the background check case you wish to create.
          </p>
        </div>
        <div className="mt-5 space-y-6 md:col-span-2 md:mt-0">
          <div className="grid grid-cols-6 gap-6">
            <div className="col-span-6 sm:col-span-3">
              <label htmlFor="employer_name" className="block text-sm font-medium text-gray-700">
                Employer Name
              </label>
              <input
                type="text"
                name="employer_name"
                id="employer_name"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>

            <div className="col-span-6 sm:col-span-3">
              <label htmlFor="candidate_name" className="block text-sm font-medium text-gray-700">
                Candidate Name
              </label>
              <input
                type="text"
                name="candidate_name"
                id="candidate_name"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>

            <div className="col-span-6">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Case Title / Description
              </label>
              <input
                type="text"
                name="title"
                id="title"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>

            <div className="col-span-6 sm:col-span-2">
              <label htmlFor="claimed_ctc" className="block text-sm font-medium text-gray-700">
                Claimed CTC (INR)
              </label>
              <input
                type="number"
                name="claimed_ctc"
                id="claimed_ctc"
                required
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>

            <div className="col-span-6 sm:col-span-2">
              <label htmlFor="employment_start" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                name="employment_start"
                id="employment_start"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>

            <div className="col-span-6 sm:col-span-2">
              <label htmlFor="employment_end" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                name="employment_end"
                id="employment_end"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>

            <div className="col-span-6 sm:col-span-3">
              <label htmlFor="uan" className="block text-sm font-medium text-gray-700">
                UAN (Optional)
              </label>
              <input
                type="text"
                name="uan"
                id="uan"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error creating case</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Create Case'}
        </button>
      </div>
    </form>
  );
}
