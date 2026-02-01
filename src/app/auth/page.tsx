'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { generateAndSendCode, verifyEmailCode, resendCode } from '@/actions/verificationActions';
import { Mail, User, Phone, MapPin, Lock, Code, ArrowRight, Check, LogIn, RefreshCw } from 'lucide-react';

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: '',
    referral: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent multiple submissions

    setError(null);
    setSuccessMsg(null);

    if (mode === 'signup') {
      if (!formData.fullName || !formData.username || !formData.email || !formData.phone || !formData.address || !formData.password) {
        setError('All required fields must be filled');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    } else {
      if (!formData.email || !formData.password) {
        setError('Email and password required');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              username: formData.username,
              phone: formData.phone,
              address: formData.address,
              referral: formData.referral || null,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Trigger custom verification flow
          await generateAndSendCode(data.user.id, formData.email);
          setVerifyEmail(formData.email);
          setStep('verify');
          setSuccessMsg('Verification code sent! Check your email.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) throw signInError;
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed — try again');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Important: Prevents the 400 error from double clicks

    setError(null);
    setLoading(true);

    try {
      // Use the refactored action that returns { success, error }
      const result = await verifyEmailCode(verifyEmail, verifyCode);
      
      if (!result.success) {
        throw new Error(result.error || 'Invalid or expired code');
      }

      setSuccessMsg('Email verified! Logging you in...');
      
      // Auto login after verification
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: verifyEmail,
        password: formData.password,
      });

      if (signInError) throw signInError;

      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code');
      setSuccessMsg(null); // Clear success if verification fails
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setError(null);
    try {
        await resendCode(verifyEmail);
        setSuccessMsg('New code sent!');
        setResendCooldown(60);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  // Cooldown Timer Effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="bg-brand-mint p-2 rounded-xl group-hover:rotate-6 transition-transform">
              <div className="bg-brand-carbon text-brand-mint font-black px-3 py-1 rounded-lg text-xl">DS</div>
            </div>
            <span className="text-4xl font-black text-white tracking-tighter">
              DASH<span className="text-brand-mint">SUB</span>
            </span>
          </Link>
          <p className="text-brand-gray/60 mt-4 text-lg">
            {step === 'form' ? (mode === 'signup' ? 'Create your account' : 'Welcome back') : 'Verify your email'}
          </p>
        </div>

        {/* Step 1: Login/Signup Form */}
        {step === 'form' && (
          <>
            <div className="flex justify-center mb-8">
              <div className="bg-brand-carbon/30 rounded-2xl p-1 flex gap-2">
                <button
                  onClick={() => setMode('signup')}
                  className={`px-8 py-3 rounded-xl font-bold transition-all ${mode === 'signup' ? 'bg-brand-mint text-brand-carbon' : 'text-brand-gray/60'}`}
                >
                  Sign Up
                </button>
                <button
                  onClick={() => setMode('signin')}
                  className={`px-8 py-3 rounded-xl font-bold transition-all ${mode === 'signin' ? 'bg-brand-mint text-brand-carbon' : 'text-brand-gray/60'}`}
                >
                  Sign In
                </button>
              </div>
            </div>

            <div className="bg-brand-carbon/50 backdrop-blur-xl rounded-[3rem] p-10 md:p-16 border border-white/5 shadow-2xl">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-6 py-4 rounded-2xl text-center font-medium mb-6">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="relative">
                  <Mail size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mint/60" />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email Address *"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all"
                  />
                </div>

                {mode === 'signup' && (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="relative">
                      <User size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mint/60" />
                      <input type="text" name="fullName" placeholder="Full Name *" value={formData.fullName} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all" />
                    </div>
                    <div className="relative">
                      <User size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mint/60" />
                      <input type="text" name="username" placeholder="Username *" value={formData.username} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all" />
                    </div>
                    <div className="relative">
                      <Phone size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mint/60" />
                      <input type="tel" name="phone" placeholder="Phone Number *" value={formData.phone} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all" />
                    </div>
                    <div className="relative md:col-span-2">
                      <MapPin size={20} className="absolute left-5 top-6 text-brand-mint/60" />
                      <input type="text" name="address" placeholder="Full Address *" value={formData.address} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all" />
                    </div>
                    <div className="relative">
                      <Lock size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mint/60" />
                      <input type="password" name="password" placeholder="Password *" value={formData.password} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all" />
                    </div>
                    <div className="relative">
                      <Lock size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mint/60" />
                      <input type="password" name="confirmPassword" placeholder="Confirm Password *" value={formData.confirmPassword} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all" />
                    </div>
                  </div>
                )}

                {mode === 'signin' && (
                  <div className="relative">
                    <Lock size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mint/60" />
                    <input type="password" name="password" placeholder="Password *" value={formData.password} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all" />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-mint text-brand-carbon py-6 rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-white hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
                >
                  {loading ? 'Processing...' : (mode === 'signup' ? 'Create Account' : 'Sign In')}
                  {!loading && (mode === 'signup' ? <ArrowRight size={20} /> : <LogIn size={20} />)}
                </button>
              </form>
            </div>
          </>
        )}

        {/* Step 2: Verification UI */}
        {step === 'verify' && (
          <div className="bg-brand-carbon/50 backdrop-blur-xl rounded-[3rem] p-10 md:p-16 border border-white/5 shadow-2xl">
            {/* Conditional Status Messages - Optimized to not overlap */}
            {error ? (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-6 py-4 rounded-2xl text-center font-medium mb-6">
                {error}
              </div>
            ) : successMsg ? (
              <div className="bg-green-500/20 border border-green-500/50 text-green-200 px-6 py-4 rounded-2xl text-center font-medium mb-6">
                {successMsg}
              </div>
            ) : null}

            <div className="text-center space-y-8">
              <div className="w-20 h-20 bg-brand-mint/20 rounded-full flex items-center justify-center mx-auto">
                <Mail size={40} className="text-brand-mint" />
              </div>
              <div>
                <h3 className="text-3xl font-black text-white mb-4">Check Your Email</h3>
                <p className="text-brand-gray/60 max-w-md mx-auto">
                  We sent a 6-digit verification code to <strong>{verifyEmail}</strong>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="274785"
                  maxLength={6}
                  required
                  className="w-full text-center text-4xl tracking-[1rem] bg-white/5 border border-white/10 rounded-2xl py-6 text-white placeholder-brand-gray/20 focus:outline-none focus:border-brand-mint transition-all"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-mint text-brand-carbon py-6 rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-white hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                  {!loading && <Check size={20} />}
                </button>
              </form>

              <div className="text-brand-gray/60">
                <p className="text-sm">
                  Didn't receive it? 
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    className="text-brand-mint font-bold ml-2 hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    Resend Code {resendCooldown > 0 && `(${resendCooldown}s)`}
                  </button>
                </p>
              </div>

              <button
                onClick={() => setStep('form')}
                className="text-brand-mint/80 hover:text-brand-mint text-sm font-medium"
              >
                ← Back to signup
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-brand-gray/40 text-sm mt-8">
          <Link href="/" className="text-brand-mint hover:underline">Back to Home</Link>
        </p>
      </div>
    </div>
  );
}