'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Zap, Server, Shield, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { forgotPasswordAction } from '@/lib/api/auth';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    const result = await forgotPasswordAction(email);
    setIsLoading(false);

    if (result.success) {
      setIsSubmitted(true);
    } else {
      toast.error(result.error || 'Failed to process request');
    }
  }

  return (
    <div className="min-h-screen flex w-full">
      {/* Left Split - Branding & Marketing (Dark Theme) */}
      <div className="hidden lg:flex flex-col w-1/2 bg-[#0B1528] relative overflow-hidden text-white p-16 justify-between">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.1),_transparent_40%)]"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxjaXJjbGUgY3g9IjIiIGN5PSIyIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIj48L2NpcmNsZT4KPC9zdmc+')] opacity-50"></div>

        <div className="relative z-10 max-w-xl">
          {/* Logo */}
          <Link href="/" className="inline-block mb-12 hover:opacity-90 transition-opacity">
            <div>
              <img src="/logo-icon-light.png" alt="Recheq Logo" className="w-16 h-16 object-contain" />
            </div>
          </Link>

          <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
            Account <span className="text-blue-500">Recovery</span>
          </h1>
          <p className="text-2xl text-gray-300 font-medium tracking-wide flex items-center gap-3 mb-6">
            Leave the guesswork behind.
          </p>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            Get back access to your account securely to continue verifying your documents.
          </p>
        </div>

        {/* Abstract 3D Dashboard Illustration */}
        <div className="relative z-10 my-auto h-80 flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full"></div>

          {/* Floating UI Elements */}
          <div className="relative transform rotate-[-5deg] hover:rotate-0 transition-transform duration-700">
            <div className="w-80 h-48 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-4 flex flex-col relative z-20">
              {/* Fake Window Controls */}
              <div className="flex gap-1.5 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-300"></div>
              </div>
              {/* Fake UI bars */}
              <div className="flex gap-4 mb-4">
                <div className="w-12 h-10 rounded-lg bg-blue-600/50 backdrop-blur-md"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/20 rounded w-full"></div>
                  <div className="h-3 bg-white/20 rounded w-2/3"></div>
                </div>
              </div>
              <div className="flex gap-4 flex-1">
                <div className="w-16 h-16 rounded-full border-4 border-blue-500/50 flex-shrink-0 relative">
                  <div
                    className="absolute inset-0 border-4 border-green-400 rounded-full"
                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }}
                  ></div>
                </div>
                <div className="flex-1 space-y-3 pt-2">
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <div className="h-2.5 bg-white/10 rounded w-3/4"></div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full bg-white/30"></div>
                    <div className="h-2.5 bg-white/10 rounded w-1/2"></div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full bg-white/30"></div>
                    <div className="h-2.5 bg-white/10 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Shield */}
            <div className="absolute -right-8 -bottom-8 bg-green-500 p-4 rounded-2xl shadow-2xl transform rotate-12 z-30 flex items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Footer Features */}
        <div className="relative z-10 grid grid-cols-3 gap-8">
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full border border-gray-700 bg-gray-800/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1 text-white">Secure</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Your data is protected with enterprise-grade security
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full border border-gray-700 bg-gray-800/50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1 text-white">Fast</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Quick access to your documents and information
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full border border-gray-700 bg-gray-800/50 flex items-center justify-center">
              <Server className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1 text-white">Reliable</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Accurate data you can trust, every time
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Split - Form (Light Theme) */}
      <div className="flex-1 bg-gray-50 flex flex-col justify-between p-8 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxjaXJjbGUgY3g9IjIiIGN5PSIyIiByPSIxIiBmaWxsPSJyZ2JhKDAsMCwwLDAuMDQpIj48L2NpcmNsZT4KPC9zdmc+')] pointer-events-none opacity-50 mask-image:linear-gradient(to_bottom_left,white,transparent)"></div>

        <div className="w-full mb-8 relative z-10 lg:hidden">
          <Link href="/" className="inline-block">
            <div>
              <img src="/logo-icon.png" alt="Recheq Logo" className="w-10 h-10 object-contain" />
            </div>
          </Link>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-10 relative z-10">
            <div className="mb-6">
              <Link
                href="/login"
                className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to login
              </Link>
            </div>

            {!isSubmitted ? (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot password?</h2>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    No worries, we'll send you reset instructions. Enter the email associated with
                    your account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700" htmlFor="email">
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Reset password'
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="animate-fade-in text-center py-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-8">
                  If an account exists for{' '}
                  <span className="font-semibold text-gray-900">{email}</span>, we've sent
                  instructions on how to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail('');
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Didn't receive the email? Click to try again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center relative z-10 lg:text-left">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Recheq Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
