'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';

export function BillingTab() {
  const [isManaging, setIsManaging] = useState(false);

  const handleManagePlan = async () => {
    setIsManaging(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.info('Billing portal integration pending');
    } catch (err: unknown) {
      toast.error('Failed to load billing portal');
    } finally {
      setIsManaging(false);
    }
  };

  const handleDownload = () => {
    toast.success('Invoice download started');
  };

  const handleUpdatePayment = () => {
    toast.info('Payment portal integration pending');
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-fg)]">Billing & Plans</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
          Manage your subscription, payment methods, and billing history.
        </p>
        <hr className="border-[var(--color-border)] mb-6" />
      </div>

      <div className="bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-page)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1">
            Current Plan
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--color-fg)]">Enterprise</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">
              Active
            </span>
          </div>
          <p className="text-sm text-[var(--color-fg-muted)] mt-2">
            Unlimited verifications with priority processing.
          </p>
        </div>
        <button
          onClick={handleManagePlan}
          disabled={isManaging}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 disabled:opacity-70 active:scale-95 transition-all"
        >
          {isManaging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {isManaging ? 'Loading...' : 'Manage Plan'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-[var(--color-fg)]">Payment Method</h3>
            <button
              onClick={handleUpdatePayment}
              className="text-[var(--color-accent)] text-xs font-medium hover:underline"
            >
              Update
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">VISA</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-fg)]">Visa ending in 4242</p>
              <p className="text-xs text-[var(--color-fg-muted)]">Expires 12/2028</p>
            </div>
          </div>
        </div>
        <div className="flex-1 border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-[var(--color-fg)]">Usage This Month</h3>
          </div>
          <div className="mb-2 flex justify-between items-end">
            <span className="text-2xl font-bold text-[var(--color-fg)]">1,248</span>
            <span className="text-xs text-[var(--color-fg-muted)] mb-1">/ Unlimited cases</span>
          </div>
          <div className="w-full bg-[var(--color-page)] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[var(--color-accent)] h-full transition-all duration-1000 ease-out"
              style={{ width: '45%' }}
            ></div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-[var(--color-fg)] mb-4">Billing History</h3>
        <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {[
                { id: 1, date: 'Aug 1, 2026', amount: '$499.00', status: 'Paid' },
                { id: 2, date: 'Jul 1, 2026', amount: '$499.00', status: 'Paid' },
                { id: 3, date: 'Jun 1, 2026', amount: '$499.00', status: 'Paid' },
              ].map((invoice) => (
                <tr key={invoice.id} className="hover:bg-[var(--color-page)] transition-colors">
                  <td className="px-4 py-3 text-sm text-[var(--color-fg)]">{invoice.date}</td>
                  <td className="px-4 py-3 text-sm text-[var(--color-fg)]">{invoice.amount}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={handleDownload}
                      className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors p-1"
                      title="Download Invoice"
                    >
                      <Download className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
