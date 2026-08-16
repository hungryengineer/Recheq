'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, Ghost, TriangleAlert, ExternalLink, TerminalSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Subtle Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none z-0">
        <div className="absolute top-[20%] left-[10%] w-12 h-12 bg-indigo-100 rounded-full blur-sm"></div>
        <div className="absolute bottom-[20%] right-[10%] w-16 h-16 bg-blue-100 rounded-full blur-sm"></div>
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="400"
            cy="400"
            r="300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 12"
          />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center px-4">
        {/* 404 Text with Ghost in '0' */}
        <div className="relative flex items-center justify-center mb-8">
          <h1 className="text-[180px] md:text-[220px] font-black tracking-tighter text-[#1e293b] leading-none select-none">
            4
            <span className="relative inline-flex items-center justify-center">
              0
              <div className="absolute inset-0 flex items-center justify-center mb-4">
                <div className="bg-indigo-50 w-16 h-20 md:w-20 md:h-24 rounded-full flex flex-col items-center justify-center shadow-inner relative overflow-hidden border-2 border-indigo-100/50">
                  <Ghost
                    className="w-10 h-10 md:w-12 md:h-12 text-indigo-400 mt-2"
                    strokeWidth={1.5}
                  />
                  <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-indigo-100/50 to-transparent"></div>
                </div>
              </div>
            </span>
            4
          </h1>
        </div>

        {/* Header and Text */}
        <h2 className="text-3xl md:text-4xl font-bold text-[#1e293b] mb-4">Page not found</h2>
        <p className="text-[#64748b] text-base md:text-lg mb-10 max-w-md text-center leading-relaxed">
          We looked everywhere, even asked the intern... but this page doesn't exist or might have
          been moved.
        </p>

        {/* Buttons */}
        <div className="flex gap-4 mb-12">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center px-6 py-3 rounded-xl border border-gray-200 bg-white text-[#475569] font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </button>

          <Link
            href="/login"
            className="flex items-center justify-center px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#4f46e5] transition-colors shadow-md shadow-indigo-500/20"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Link>
        </div>

        {/* Terminal Log Box */}
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div>
            </div>
            <span className="text-xs font-mono text-gray-400 ml-2 font-medium">system.log</span>
          </div>

          <div className="font-mono text-xs leading-relaxed text-gray-600 pr-24 relative z-10">
            <p>
              <span className="text-gray-400">10:24:31</span>{' '}
              <span className="text-blue-500 font-semibold">INFO</span> Searching for requested
              resource...
            </p>
            <p>
              <span className="text-gray-400">10:24:31</span>{' '}
              <span className="text-blue-500 font-semibold">INFO</span> Checking global databases...
            </p>
            <p>
              <span className="text-gray-400">10:24:32</span>{' '}
              <span className="text-amber-500 font-semibold">WARN</span> No matching records found.
            </p>
            <p className="text-red-500">
              <span className="text-gray-400">10:24:32</span>{' '}
              <span className="font-semibold">ERROR</span> 404 NOT_FOUND. The suspect has evaded
              capture.
            </p>
          </div>

          {/* Hacker Icon in Terminal */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
            <div className="relative">
              <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <TerminalSquare className="w-12 h-12 text-gray-500" />
              </div>
              <TriangleAlert className="absolute -bottom-2 -right-2 w-6 h-6 text-gray-500 fill-white" />
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <Link
          href="/support"
          className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center"
        >
          Need help? Contact support <ExternalLink className="w-3 h-3 ml-1" />
        </Link>
      </div>

      {/* Curved Bottom Decoration */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-0">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-[150px] fill-indigo-50/50"
        >
          <path
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            opacity=".25"
          ></path>
          <path
            d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
            opacity=".5"
          ></path>
          <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"></path>
        </svg>
      </div>
    </div>
  );
}
