'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { Shield, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLogin() {
  const router = useRouter();
  const { session } = useSupabaseSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkExistingAdmin = async () => {
      if (session?.user?.id) {
        // Check via API to bypass RLS
        const response = await fetch('/api/admin/check-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id }),
        });

        const data = await response.json();

        if (data.isAdmin) {
          router.push('/admin');
        }
      }
    };

    checkExistingAdmin();
  }, [session, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting admin login...');

      // Sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Login failed');
      }

      console.log('✅ Auth successful, checking admin status...');

      // Check admin status via API (bypasses RLS)
      const response = await fetch('/api/admin/check-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id }),
      });

      const data = await response.json();

      if (!data.isAdmin) {
        console.error('Not an admin');
        await supabase.auth.signOut();
        throw new Error('Access denied: Admin credentials required');
      }

      console.log('✅ Admin verified, redirecting...');
      toast.success('Welcome back, Admin!');
      
      setTimeout(() => {
        router.push('/admin');
      }, 500);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-carbon flex items-center justify-center p-6">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-mint/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-mint to-emerald-400 rounded-3xl mb-4 shadow-2xl shadow-brand-mint/20">
            <Shield className="w-10 h-10 text-brand-carbon" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Admin Portal</h1>
          <p className="text-brand-gray/60">Sign in to access the admin dashboard</p>
        </div>

        <div className="bg-brand-primary/50 backdrop-blur-xl border border-brand-mint/10 rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-sm font-semibold">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-brand-gray/80 mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dashsub.com"
                required
                autoComplete="email"
                className="w-full bg-brand-carbon/50 border-2 border-brand-mint/20 rounded-2xl px-5 py-4 text-white text-lg placeholder:text-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-gray/80 mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-brand-carbon/50 border-2 border-brand-mint/20 rounded-2xl px-5 py-4 text-white text-lg placeholder:text-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-mint to-emerald-400 text-brand-carbon font-black text-lg py-5 rounded-2xl hover:shadow-2xl hover:shadow-brand-mint/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="w-6 h-6" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-brand-mint/5 border border-brand-mint/10 rounded-2xl">
            <p className="text-xs text-brand-gray/60 text-center">
              🔒 This is a secured admin area. All activities are logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}