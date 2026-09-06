'use client';
import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, ShieldCheck, Zap, Server, Shield, Building2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/lib/api/auth';
import { isSafeRelativePath } from '@/lib/safe-path';
import { toast } from 'sonner';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getRedirectUrl = () => {
    const nextParam = searchParams.get('next');
    if (nextParam && isSafeRelativePath(nextParam)) {
      return nextParam;
    }
    return '/cases';
  };
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [authMode, setAuthMode] = useState<'password' | 'sso'>('password');
  const [ssoDomain, setSsoDomain] = useState('');
  const [isSsoLoading, setIsSsoLoading] = useState(false);

  const handleSsoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ssoDomain.trim()) {
      setErrors({ sso: 'Please enter your organization domain or work email.' });
      return;
    }
    setErrors({});
    setIsSsoLoading(true);

    const { ssoLoginAction } = await import('@/lib/api/auth');
    toast.loading('Redirecting to Identity Provider...', { id: 'sso' });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result = await ssoLoginAction();
    if (!result.success) {
      toast.error(result.error || 'SSO Login failed', { id: 'sso' });
      setErrors({ form: result.error || 'SSO Login failed' });
      setIsSsoLoading(false);
      return;
    }

    toast.success('Authenticated successfully via SSO!', { id: 'sso' });
    router.push(getRedirectUrl());
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const rememberMe = formData.get('rememberMe') === 'on';

    const result = await loginAction({ email, password, rememberMe });

    if (!result.success) {
      if (result.errors) {
        setErrors(result.errors);
      } else if (result.error) {
        setErrors({ form: result.error });
      }
      setIsLoading(false);
      return;
    }

    // On success, redirect to dashboard
    router.push(getRedirectUrl());
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
          <div className="mb-12">
            <img src="/logo-icon-light.png" alt="Recheq Logo" className="w-16 h-16 object-contain" />
          </div>

          <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
            Welcome to <span className="text-blue-500">Recheq</span>
          </h1>
          <p className="text-2xl text-gray-300 font-medium tracking-wide flex items-center gap-3 mb-6">
            Leave the guesswork behind.
          </p>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            Sign in to automate background checks and uncover the truth in seconds.
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

            {/* Floating Particles */}
            <div className="absolute -top-12 left-12 w-3 h-3 rounded-full border border-blue-400/50 animate-pulse"></div>
            <div className="absolute top-24 -right-16 w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
            <div className="absolute -bottom-16 left-32 w-4 h-4 rounded border border-green-500/50 rotate-45"></div>
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

      {/* Right Split - Login Form (Light Theme) */}
      <div className="flex-1 bg-gray-50 flex flex-col justify-between p-8 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxjaXJjbGUgY3g9IjIiIGN5PSIyIiByPSIxIiBmaWxsPSJyZ2JhKDAsMCwwLDAuMDQpIj48L2NpcmNsZT4KPC9zdmc+')] pointer-events-none opacity-50 mask-image:linear-gradient(to_bottom_left,white,transparent)"></div>

        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-10 relative z-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to your account</h2>
              <p className="text-sm text-gray-500">Enter your credentials to access Recheq</p>
            </div>

            {errors.form && (
              <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100 text-center">
                {errors.form}
              </div>
            )}

            {authMode === 'password' ? (
              <>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700" htmlFor="email">
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg
                          className="h-5 w-5 text-gray-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Enter your email"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder:text-gray-400"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-700" htmlFor="password">
                        Password
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder:text-gray-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                    )}
                  </div>

                  <div className="flex items-center">
                    <input
                      id="rememberMe"
                      name="rememberMe"
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer focus:ring-blue-500"
                    />
                    <label
                      htmlFor="rememberMe"
                      className="ml-2 block text-sm text-gray-700 cursor-pointer select-none"
                    >
                      Remember me
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>

                <div className="mt-8">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-400 text-xs uppercase tracking-wider">
                        or continue with
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setErrors({});
                        setAuthMode('sso');
                      }}
                      className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors"
                    >
                      <ShieldCheck className="w-5 h-5 text-blue-600 mr-2" />
                      Sign in with SSO
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <form onSubmit={handleSsoSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700" htmlFor="ssoDomain">
                    Organization Domain
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="ssoDomain"
                      name="ssoDomain"
                      type="text"
                      placeholder="e.g. acme.com or user@acme.com"
                      value={ssoDomain}
                      onChange={(e) => setSsoDomain(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSsoLoading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 transition-colors"
                >
                  {isSsoLoading ? 'Redirecting to IdP...' : 'Continue to Identity Provider'}
                </button>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setAuthMode('password');
                    }}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Back to password login
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-500">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Right Split Footer */}
        <div className="relative z-10 flex justify-between items-center text-xs text-gray-500 px-4">
          <p>© 2026 Recheq Technologies Pvt Ltd. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0B1528] text-white">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
