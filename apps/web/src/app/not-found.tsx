'use client';

import React from 'react';
import Link from 'next/link';
import { Search, FileQuestion, ArrowLeft, Fingerprint, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col items-center justify-center relative overflow-hidden px-4">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Floating Icons (Animated) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[20%] animate-bounce text-blue-500/20" style={{ animationDuration: '4s' }}>
          <FileQuestion size={120} />
        </div>
        <div className="absolute bottom-[20%] right-[15%] animate-pulse text-indigo-500/10" style={{ animationDuration: '3s' }}>
          <Fingerprint size={180} />
        </div>
        <div className="absolute top-[30%] right-[25%] animate-spin text-purple-500/20" style={{ animationDuration: '12s' }}>
          <Search size={80} />
        </div>
      </div>

      <div className="relative z-10 max-w-2xl w-full text-center flex flex-col items-center">
        
        {/* Playful 404 Header */}
        <div className="relative mb-8 flex justify-center items-center">
          <h1 className="text-[150px] md:text-[200px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 leading-none select-none drop-shadow-xl">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center mix-blend-overlay opacity-30 pointer-events-none">
            <ShieldAlert size={150} className="text-white" />
          </div>
        </div>

        {/* Humorous & Industry-Themed Copy */}
        <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-fg)] mb-4 tracking-tight">
          Verification Failed: Page Not Found
        </h2>
        <p className="text-lg md:text-xl text-[var(--color-fg-muted)] mb-10 max-w-lg leading-relaxed">
          We ran a background check on this URL, scoured the global databases, and even asked the intern... but this page simply doesn't exist.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
          <button 
            onClick={() => router.back()}
            className="flex items-center justify-center px-6 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm group w-full sm:w-auto"
          >
            <ArrowLeft className="w-5 h-5 mr-2 text-[var(--color-fg-subtle)] group-hover:-translate-x-1 transition-transform" />
            Go Back
          </button>
          
          <Link 
            href="/cases"
            className="flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 w-full sm:w-auto hover:-translate-y-0.5"
          >
            <Search className="w-5 h-5 mr-2" />
            Return to Dashboard
          </Link>
        </div>

        {/* Fake Terminal Log */}
        <div className="mt-16 bg-gray-900 rounded-xl p-4 w-full max-w-md text-left font-mono text-xs text-green-400 shadow-2xl overflow-hidden border border-gray-800">
          <div className="flex items-center gap-2 mb-3 border-b border-gray-800 pb-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-500 ml-2">sys_audit.log</span>
          </div>
          <div className="space-y-1 opacity-80">
            <p><span className="text-blue-400">INFO</span> [system] Initiating search for requested route...</p>
            <p><span className="text-blue-400">INFO</span> [router] Querying active endpoints...</p>
            <p><span className="text-yellow-400">WARN</span> [dns] No matching records found in index.</p>
            <p className="text-red-400 animate-pulse"><span className="text-red-500">ERR!</span> [core] 404 NOT_FOUND. The suspect has evaded capture.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
