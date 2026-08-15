import React from 'react';

interface NotAssessedListProps {
  rules: string[];
}

export function NotAssessedList({ rules }: NotAssessedListProps) {
  if (!rules || rules.length === 0) return null;

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
        Not Assessed
      </h3>
      <p className="mt-1 text-sm text-gray-500 mb-4">
        The following rules could not be evaluated due to missing evidence or context:
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rules.map((rule) => (
          <li key={rule} className="col-span-1 flex rounded-md shadow-sm border border-gray-200">
            <div className="flex flex-1 items-center justify-between rounded-r-md bg-white px-4 py-2">
              <div className="flex-1 truncate">
                <span className="font-mono text-xs text-gray-600">{rule}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
