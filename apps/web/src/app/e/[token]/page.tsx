'use client';

import React, { useEffect, useState, use } from 'react';
import type { PublicEmployerContext } from '../../../lib/api/employer';
import { getEmployerForm } from '../../../lib/api/employer';
import { EmployerConfirmationForm } from '../../../components/employer/EmployerConfirmationForm';

export default function EmployerVerificationPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [context, setContext] = useState<PublicEmployerContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadForm() {
      try {
        const data = await getEmployerForm(token);
        setContext(data);
        if (data.status === 'submitted') {
          setSubmitted(true);
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.message === 'TOKEN_EXPIRED') {
            setError('This verification link has expired. Please contact Recheq support.');
          } else if (err.message === 'TOKEN_INVALID' || err.message === 'REQUEST_NOT_FOUND') {
            setError('This verification link is invalid. Please check the URL and try again.');
          } else {
            setError('An unexpected error occurred. Please try again later.');
          }
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 animate-pulse">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="h-10 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 h-96"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Recheq</h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Verification Error</h3>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted || context?.status === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Recheq</h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Response Recorded</h3>
            <p className="mt-2 text-sm text-gray-500">
              Thank you for verifying employment details for {context?.candidate_name}.
              This window can now be safely closed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">Recheq</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Secure Employment Verification
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        {context && (
          <EmployerConfirmationForm
            token={token}
            context={context}
            onSuccess={() => setSubmitted(true)}
          />
        )}
      </div>
    </div>
  );
}
