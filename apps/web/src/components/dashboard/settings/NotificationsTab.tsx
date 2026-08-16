'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

export function NotificationsTab() {
  const [preferences, setPreferences] = useState({
    caseCompletions: true,
    documentUploads: false,
    billingReceipts: true,
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences((prev) => {
      const newState = !prev[key];
      if (newState) {
        toast.success(`Notification enabled`);
      } else {
        toast.info(`Notification disabled`);
      }
      return { ...prev, [key]: newState };
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-fg)]">Notifications</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
          Manage how we contact you regarding case updates and system alerts.
        </p>
        <hr className="border-[var(--color-border)] mb-6" />
      </div>

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-fg)]">Case Completions</h3>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1">
              Get an email when a verification case is fully processed.
            </p>
          </div>
          <label
            htmlFor="caseCompletionsToggle"
            className="relative inline-flex items-center cursor-pointer mr-2"
          >
            <input
              id="caseCompletionsToggle"
              type="checkbox"
              className="sr-only peer"
              checked={preferences.caseCompletions}
              onChange={() => handleToggle('caseCompletions')}
            />
            <div className="w-11 h-6 bg-gray-300 dark:bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
          </label>
        </div>

        <hr className="border-[var(--color-border)]" />

        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-fg)]">
              Candidate Document Uploads
            </h3>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1">
              Get notified when a candidate uploads their forms.
            </p>
          </div>
          <label
            htmlFor="documentUploadsToggle"
            className="relative inline-flex items-center cursor-pointer mr-2"
          >
            <input
              id="documentUploadsToggle"
              type="checkbox"
              className="sr-only peer"
              checked={preferences.documentUploads}
              onChange={() => handleToggle('documentUploads')}
            />
            <div className="w-11 h-6 bg-gray-300 dark:bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
          </label>
        </div>

        <hr className="border-[var(--color-border)]" />

        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-fg)]">Billing Receipts</h3>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1">
              Receive monthly invoices and billing updates.
            </p>
          </div>
          <label
            htmlFor="billingReceiptsToggle"
            className="relative inline-flex items-center cursor-pointer mr-2"
          >
            <input
              id="billingReceiptsToggle"
              type="checkbox"
              className="sr-only peer"
              checked={preferences.billingReceipts}
              onChange={() => handleToggle('billingReceipts')}
            />
            <div className="w-11 h-6 bg-gray-300 dark:bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
