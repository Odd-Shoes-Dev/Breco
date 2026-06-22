'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sign in');

      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirectTo') || '/dashboard';

      toast.success('Welcome back!');
      window.location.href = redirectTo;
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex flex-col justify-center p-4 py-8">
      <div className="w-full max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <Image
              src="/assets/logo.jpg"
              alt="Breco Safaris Ltd"
              width={270}
              height={108}
              className="mx-auto -mb-4"
            />
          </Link>
          <p className="text-breco-navy font-semibold text-lg mt-6">
            Financial Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="card shadow-xl border border-blue-100">
          <div className="card-header bg-[#fff]">
            <h1 className="text-xl font-semibold text-breco-navy">Sign In</h1>
            <p className="text-sm text-breco-navy mt-1">
              Access your operations dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="card-body space-y-4">
            <div className="form-group">
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@brecosafaris.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-breco-navy focus:ring-breco-navy"
                />
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="card-footer text-center">
            <p className="text-sm text-gray-600">
              Need an account?{' '}
              {process.env.NEXT_PUBLIC_SIGNUPS_ENABLED === 'true' ? (
                <Link href="/signup" className="text-breco-navy hover:text-breco-navy-dark hover:underline font-medium">
                  Contact administrator
                </Link>
              ) : (
                <span className="text-gray-500">Contact administrator</span>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          &copy; {new Date().getFullYear()} Breco Safaris Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}

