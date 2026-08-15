'use client';

import React, { useState } from 'react';
import { 
  FileText, X, ArrowLeft, Download, Printer, 
  Minus, Plus, Maximize, File, User, IdCard, Briefcase, Shield, 
  Building2, Wallet, PiggyBank, ChevronsLeft, ChevronsRight, ChevronRight, ChevronLeft
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface DocumentViewerProps {
  sourceLabel: string;
  onClose: () => void;
}

export function DocumentViewer({ sourceLabel, onClose }: DocumentViewerProps) {
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(true);

  const handleDownload = () => {
    // Generate a dummy text file blob just to trigger a download
    const blob = new Blob(['This is a mock PDF download generated for ' + sourceLabel], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payslip_${sourceLabel.replace('Payslip - ', '').replace(' ', '')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--color-surface)] animate-fade-in print:bg-white print:static print:inset-auto">
      {/* Sidebar Navigation */}
      <div className="w-16 border-r border-[var(--color-border)] flex flex-col items-center py-4 bg-[var(--color-surface)] z-10 shrink-0 print:hidden">
        <button 
          onClick={() => setIsThumbnailsOpen(!isThumbnailsOpen)} 
          className={`p-3 rounded-lg mb-8 relative transition-colors ${isThumbnailsOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
        >
          <File className="w-6 h-6" />
          {isThumbnailsOpen && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full"></div>}
          <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium ${isThumbnailsOpen ? 'text-blue-600' : 'text-gray-500 opacity-0'}`}>Pages</span>
        </button>
        <button onClick={handleDownload} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg mb-6 group relative">
          <Download className="w-6 h-6" />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">Download</span>
        </button>
        <button onClick={handlePrint} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg group relative">
          <Printer className="w-6 h-6" />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">Print</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden print:overflow-visible print:h-auto">
        {/* Top Header */}
        <div className="h-16 border-b border-[var(--color-border)] flex items-center justify-between px-4 bg-[var(--color-surface)] z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 ml-2">
              <div className="p-2 bg-blue-50 rounded text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-fg)]">Document Viewer</h2>
                <p className="text-xs text-[var(--color-fg-muted)]">{sourceLabel}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded">
              <button className="p-2 text-gray-500 hover:bg-gray-100"><Minus className="w-4 h-4" /></button>
              <span className="px-3 text-sm font-medium text-gray-700 border-x border-gray-200 py-1.5">100%</span>
              <button className="p-2 text-gray-500 hover:bg-gray-100"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <button className="p-2 hover:bg-gray-50 rounded"><Maximize className="w-5 h-5" /></button>
              <button onClick={handleDownload} className="p-2 hover:bg-gray-50 rounded"><Download className="w-5 h-5" /></button>
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded"><X className="w-6 h-6" /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden print:overflow-visible">
          {/* Thumbnails Panel */}
          {isThumbnailsOpen && (
            <div className="w-64 border-r border-[var(--color-border)] bg-gray-50/50 flex flex-col shrink-0 print:hidden animate-fade-in">
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Pages</span>
                <button onClick={() => setIsThumbnailsOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded transition-colors"><ChevronsLeft className="w-4 h-4" /></button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                <div className="mb-4">
                  <div className="w-full aspect-[1/1.3] bg-white border-2 border-blue-500 rounded shadow-sm relative overflow-hidden mb-2 cursor-pointer">
                    <div className="origin-top-left scale-[0.22] w-[850px] pointer-events-none">
                      <PayslipContent sourceLabel={sourceLabel} />
                    </div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded z-10 shadow-sm">1</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Document Viewer Canvas */}
          <div className="flex-1 bg-[#323639] overflow-auto flex justify-center p-8 relative print:p-0 print:bg-white print:overflow-visible">
            {/* The Document */}
            <div className="bg-white w-[850px] shrink-0 min-h-[1100px] shadow-2xl rounded-lg flex flex-col mb-16 relative print:shadow-none print:mb-0 print:border-none print:rounded-none">
              <PayslipContent sourceLabel={sourceLabel} />
            </div>
          </div>
        </div>

        {/* Bottom Footer Bar */}
        <div className="h-16 border-t border-[var(--color-border)] flex items-center justify-between px-6 bg-[var(--color-surface)] z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-[var(--color-fg)]">Payslip_{sourceLabel.replace('Payslip - ', '').replace(' ', '')}.pdf</p>
              <p className="text-xs text-[var(--color-fg-muted)]">1 page • 210 KB</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded border border-transparent hover:border-gray-200"><ChevronsLeft className="w-4 h-4" /></button>
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded border border-transparent hover:border-gray-200"><ChevronLeft className="w-4 h-4" /></button>
            <div className="px-3 text-sm font-medium border border-gray-200 rounded py-1 bg-white shadow-sm">1</div>
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded border border-transparent hover:border-gray-200"><ChevronRight className="w-4 h-4" /></button>
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded border border-transparent hover:border-gray-200"><ChevronsRight className="w-4 h-4" /></button>
          </div>

          <div>
            <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm">
              Close viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayslipContent({ sourceLabel }: { sourceLabel: string }) {
  const { companyName } = useUser();
  return (
    <>
      {/* Highlight Background Graphic */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-white pointer-events-none rounded-tr-lg"></div>
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0icmdiYSgwLDAsMCwwLjA0KSI+PC9jaXJjbGU+Cjwvc3ZnPg==')] pointer-events-none opacity-50 mask-image:linear-gradient(to_bottom_left,white,transparent) rounded-tr-lg"></div>

      <div className="px-16 pt-16 pb-12 relative z-10 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start mb-16">
          <div>
            <h1 className="text-4xl font-extrabold text-[#0B2545] tracking-tight mb-2">PAYSLIP</h1>
            <p className="text-lg text-blue-500 font-medium">{sourceLabel.replace('Payslip - ', '')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{companyName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">123 Tech Park, Phase 1</p>
              <p className="text-xs text-gray-500">Bangalore, KA 560001</p>
            </div>
          </div>
        </div>

        {/* Employee Details Boxes */}
        <div className="border border-gray-200 rounded-2xl p-6 mb-12 shadow-sm bg-white">
          <div className="grid grid-cols-2 gap-y-8 gap-x-12">
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-0.5">Employee Name</p>
                <p className="text-sm font-semibold text-gray-900">Arun Kumar</p>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                <IdCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-0.5">Employee ID</p>
                <p className="text-sm font-semibold text-gray-900">EMP-4892</p>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-0.5">Designation</p>
                <p className="text-sm font-semibold text-gray-900">Senior Software Engineer</p>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-0.5">UAN</p>
                <p className="text-sm font-semibold text-gray-900">100938472615</p>
              </div>
            </div>
          </div>
        </div>

        {/* Salary Table */}
        <div className="flex-1 border border-gray-200 rounded-2xl overflow-hidden mb-8 shadow-sm">
          <div className="grid grid-cols-2 divide-x divide-gray-200 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between items-center px-6 py-4 bg-green-50/30">
              <span className="text-[10px] font-bold tracking-wider text-green-700 uppercase">Earnings</span>
              <span className="text-[10px] font-bold tracking-wider text-green-700 uppercase">Amount</span>
            </div>
            <div className="flex justify-between items-center px-6 py-4 bg-red-50/30">
              <span className="text-[10px] font-bold tracking-wider text-red-700 uppercase">Deductions</span>
              <span className="text-[10px] font-bold tracking-wider text-red-700 uppercase">Amount</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 divide-x divide-gray-200 bg-white">
            {/* Earnings Col */}
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 text-sm text-gray-600">
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>Basic Salary</div>
                <div className="font-medium text-gray-900">₹ 52,000</div>
              </div>
              <div className="border-b border-dashed border-gray-200 mb-6 -mx-6"></div>
              <div className="flex justify-between items-center mb-6 text-sm text-gray-600">
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>House Rent Allowance</div>
                <div className="font-medium text-gray-900">₹ 20,800</div>
              </div>
              <div className="border-b border-dashed border-gray-200 mb-6 -mx-6"></div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>Special Allowance</div>
                <div className="font-medium text-gray-900">₹ 27,200</div>
              </div>
            </div>
            {/* Deductions Col */}
            <div className="p-6">
              {/* The Discrepancy Highlight Area */}
              <div className="relative group cursor-default">
                <div className="absolute -inset-x-6 -inset-y-3 bg-yellow-300/30 border-y border-yellow-400 mix-blend-multiply pointer-events-none transition-all"></div>
                <div className="absolute top-1/2 -left-3 w-2 h-2 rounded-full bg-red-500 animate-pulse -translate-y-1/2"></div>
                <div className="flex justify-between items-center relative z-10 text-sm text-gray-600">
                  <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div><span className="font-semibold text-gray-900">Provident Fund (PF)</span></div>
                  <div className="font-bold text-gray-900">₹ 3,600</div>
                </div>
              </div>
              <div className="border-b border-dashed border-gray-200 mb-6 mt-6 -mx-6"></div>
              <div className="flex justify-between items-center mb-6 text-sm text-gray-600">
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>Professional Tax</div>
                <div className="font-medium text-gray-900">₹ 200</div>
              </div>
              <div className="border-b border-dashed border-gray-200 mb-6 -mx-6"></div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>Income Tax</div>
                <div className="font-medium text-gray-900">₹ 14,500</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Totals */}
        <div className="flex gap-4 mt-auto">
          <div className="flex-1 bg-green-50/50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full border border-green-200 flex items-center justify-center shadow-sm">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-green-800 uppercase mb-1">Total Earnings</p>
                <p className="text-xl font-bold text-gray-900">₹ 1,00,000</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 bg-red-50/50 border border-red-100 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full border border-red-200 flex items-center justify-center shadow-sm">
                <PiggyBank className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-red-800 uppercase mb-1">Total Deductions</p>
                <p className="text-xl font-bold text-gray-900">₹ 18,300</p>
              </div>
            </div>
          </div>

          <div className="flex-[1.2] bg-white border-2 border-blue-200 rounded-xl p-4 flex items-center justify-center shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-50/30"></div>
            <div className="relative z-10 text-center">
              <p className="text-[10px] font-bold tracking-wider text-blue-600 uppercase mb-1">Net Pay</p>
              <p className="text-2xl font-bold text-blue-700">₹ 81,700</p>
              <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">(Earnings - Deductions)</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
