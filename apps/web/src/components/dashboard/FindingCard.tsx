'use client';

import React, { useState } from 'react';
import { getFriendlyRuleTitle } from '@/lib/rule-display';
import { FileText, X } from 'lucide-react';

export function FindingCard({ finding }: { finding: Record<string, any> }) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const severityColor =
    finding.severity === 'high'
      ? 'var(--color-high)'
      : finding.severity === 'medium'
        ? 'var(--color-medium)'
        : 'var(--color-fg-muted)';
  const severityBg =
    finding.severity === 'high'
      ? 'var(--color-high-bg)'
      : finding.severity === 'medium'
        ? 'var(--color-medium-bg)'
        : 'var(--color-page)';

  return (
    <>
      <div
        className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-sm border overflow-hidden"
        style={{ borderColor: severityColor }}
      >
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center space-x-3">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: severityBg, color: severityColor }}
              >
                {finding.severity}
              </span>
              <h3 className="text-[14px] font-medium text-[var(--color-fg)]">
                {getFriendlyRuleTitle(finding.rule_id as string)}
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">
              {finding.rule_id}
            </span>
          </div>

          <p className="text-[12px] text-[var(--color-fg-muted)] mb-4">{finding.explanation}</p>

          <div className="flex justify-between items-end">
            <div className="flex space-x-8">
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-[var(--color-fg-subtle)] mb-1 uppercase">
                  Expected
                </div>
                <div className="font-mono text-[13px] text-[var(--color-fg)]">
                  {finding.expected}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-[var(--color-fg-subtle)] mb-1 uppercase">
                  Observed
                </div>
                <div
                  className="font-mono text-[13px] font-medium"
                  style={{ color: severityColor }}
                >
                  {finding.observed}
                </div>
              </div>
            </div>

            {finding.source_label && (
              <button 
                onClick={() => setIsViewerOpen(true)}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1 active:scale-95 transition-all focus:outline-none"
              >
                <FileText className="w-3 h-3" />
                {finding.source_label}
              </button>
            )}
          </div>
        </div>
      </div>

      {isViewerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[var(--color-border)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-page)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--color-accent-bg)] rounded-lg">
                  <FileText className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-fg)]">Document Viewer</h3>
                  <p className="text-xs text-[var(--color-fg-muted)]">{finding.source_label}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsViewerOpen(false)}
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 bg-[#323639] p-8 md:p-12 overflow-auto flex items-start justify-center min-h-[500px]">
              {/* Mock PDF rendering */}
              <div className="bg-white w-full max-w-2xl shrink-0 min-h-[800px] shadow-2xl rounded-sm p-12 mx-auto flex flex-col relative">
                <div className="absolute top-0 right-0 p-8 text-4xl text-gray-100 font-bold rotate-12 opacity-50 select-none">
                  MOCK DOCUMENT
                </div>
                <div className="flex justify-between items-start mb-12 border-b-2 border-gray-100 pb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">PAYSLIP</h1>
                    <p className="text-sm text-gray-500 mt-1">{finding.source_label?.replace('Payslip - ', '')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">Acme Technologies Pvt Ltd</p>
                    <p className="text-xs text-gray-500 mt-1">123 Tech Park, Phase 1</p>
                    <p className="text-xs text-gray-500">Bangalore, KA 560001</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-12">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Employee Name</p>
                    <p className="text-sm text-gray-800 font-medium">Arun Kumar</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Employee ID</p>
                    <p className="text-sm text-gray-800 font-medium">EMP-4892</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Designation</p>
                    <p className="text-sm text-gray-800 font-medium">Senior Software Engineer</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">UAN</p>
                    <p className="text-sm text-gray-800 font-medium">100938472615</p>
                  </div>
                </div>

                <table className="w-full mb-12 border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="py-2 text-left text-xs font-semibold text-gray-700 uppercase">Earnings</th>
                      <th className="py-2 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                      <th className="py-2 pl-8 text-left text-xs font-semibold text-gray-700 uppercase">Deductions</th>
                      <th className="py-2 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-600">
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Basic Salary</td>
                      <td className="py-3 text-right">₹ 52,000</td>
                      <td className="py-3 pl-8 relative">
                        <span className="relative z-10 text-gray-800">Provident Fund (PF)</span>
                        <div className="absolute inset-y-1 left-6 right-0 bg-red-500/10 border-2 border-red-500/40 rounded-sm pointer-events-none"></div>
                      </td>
                      <td className="py-3 text-right relative">
                        <span className="relative z-10 text-gray-800">₹ 3,600</span>
                        <div className="absolute inset-y-1 left-0 right-0 bg-red-500/10 border-2 border-red-500/40 rounded-sm pointer-events-none"></div>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">House Rent Allowance</td>
                      <td className="py-3 text-right">₹ 20,800</td>
                      <td className="py-3 pl-8">Professional Tax</td>
                      <td className="py-3 text-right">₹ 200</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Special Allowance</td>
                      <td className="py-3 text-right">₹ 27,200</td>
                      <td className="py-3 pl-8">Income Tax</td>
                      <td className="py-3 text-right">₹ 14,500</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-gray-800 bg-gray-50 border-t-2 border-gray-800">
                      <td className="py-3 px-2">Total Earnings</td>
                      <td className="py-3 text-right pr-2">₹ 1,00,000</td>
                      <td className="py-3 pl-8">Total Deductions</td>
                      <td className="py-3 text-right pr-2">₹ 18,300</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="mt-auto">
                  <div className="flex justify-between items-end border-t border-gray-200 pt-6">
                    <div>
                      <p className="text-xs text-gray-400">Net Pay (in words)</p>
                      <p className="text-sm font-medium text-gray-700">Eighty One Thousand Seven Hundred Only</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">Net Pay</p>
                      <p className="text-2xl font-bold text-gray-800">₹ 81,700</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex justify-end">
              <button 
                onClick={() => setIsViewerOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] rounded-[var(--radius-control)] hover:opacity-90 active:scale-95 transition-all focus:outline-none"
              >
                Close viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
