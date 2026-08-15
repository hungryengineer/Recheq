import React from 'react';
import { CreateCaseForm } from '@/components/dashboard/CreateCaseForm';

export default function NewCasePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold leading-6 text-gray-900">Create New Case</h1>
        <p className="mt-2 text-sm text-gray-700">
          Initiate a new background check for a candidate. They will receive a link to provide their
          consent and documents.
        </p>
      </div>

      <CreateCaseForm />
    </div>
  );
}
