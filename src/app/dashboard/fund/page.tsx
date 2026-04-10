'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wallet, ArrowLeft, History, ShieldCheck, Zap,
  Loader2, Landmark, Copy, Check, Lock, Clock,
  ArrowRight, CreditCard, BadgeCheck, AlertCircle,
  X, Eye, EyeOff, Shield, Info, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  reference: string;
  type: string;
}

declare global { interface Window { PaystackPop: any; } }

const isPaymentLocked  = (ref: string) => typeof window !== 'undefined' && localStorage.getItem(`payment_lock_${ref}`) === 'true';
const lockPayment      = (ref: string) => typeof window !== 'undefined' && localStorage.setItem(`payment_lock_${ref}`, 'true');
const unlockPayment    = (ref: string) => typeof window !== 'undefined' && localStorage.removeItem(`payment_lock_${ref}`);

const fmt      = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
const fmtShort = (n: number) => n.toLocaleString('en-NG');

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

// ─── BVN/NIN Modal ───────────────────────────────────────────────────────────

function BvnNinModal({
  onSubmit, onClose, loading,
}: {
  onSubmit: (type: 'bvn' | 'nin', value: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [idType, setIdType]   = useState<'bvn' | 'nin'>('bvn');
  const [value, setValue]     = useState('');
  const [show, setShow]       = useState(false);
  const [agreed, setAgreed]   = useState(false);
  const [error, setError]     = useState('');

  function validate() {
    if (!value.trim())              return 'Please enter your ' + idType.toUpperCase();
    if (idType === 'bvn' && !/^\d{11}$/.test(value)) return 'BVN must be exactly 11 digits';
    if (idType === 'nin' && !/^\d{11}$/.test(value)) return 'NIN must be exactly 11 digits';
    if (!agreed)                    return 'You must agree to the terms to continue';
    return '';
  }

  function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    onSubmit(idType, value);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: '#0D1A1A', border: '1px solid rgba(83,230,212,0.2)',
        borderRadius: 24, padding: 28, width: '100%', maxWidth: 420,
        fontFamily: "'Sora', sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(83,230,212,0.1)', border: '1px solid rgba(83,230,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: 18, height: 18, color: '#53E6D4' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#F4F7F7' }}>Identity Verification</p>
              <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.4)' }}>Required for virtual account</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'rgba(244,247,247,0.5)' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Info banner */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(83,230,212,0.06)', border: '1px solid rgba(83,230,212,0.12)', marginBottom: 22 }}>
          <Info style={{ width: 14, height: 14, color: '#53E6D4', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: 'rgba(83,230,212,0.8)', lineHeight: 1.6 }}>
            The Central Bank of Nigeria (CBN) requires identity verification to create a dedicated virtual bank account. Your data is encrypted and never shared.
          </p>
        </div>

        {/* ID Type selector */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(244,247,247,0.5)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>
          Select ID Type
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          {([
            { key: 'bvn', label: 'BVN', sub: 'Bank Verification Number' },
            { key: 'nin', label: 'NIN', sub: 'National Identity Number' },
          ] as const).map(opt => (
            <button key={opt.key} onClick={() => { setIdType(opt.key); setValue(''); setError(''); }}
              style={{
                padding: '14px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${idType === opt.key ? 'rgba(83,230,212,0.5)' : 'rgba(255,255,255,0.08)'}`,
                background: idType === opt.key ? 'rgba(83,230,212,0.08)' : 'rgba(255,255,255,0.02)',
                transition: 'all .15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: idType === opt.key ? '#53E6D4' : '#F4F7F7' }}>{opt.label}</span>
                {idType === opt.key && <Check style={{ width: 14, height: 14, color: '#53E6D4' }} />}
              </div>
              <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.4)', fontWeight: 600 }}>{opt.sub}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(244,247,247,0.5)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
          Enter your {idType.toUpperCase()}
        </p>
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => { setValue(e.target.value.replace(/\D/g, '').slice(0, 11)); setError(''); }}
            placeholder={`Enter your 11-digit ${idType.toUpperCase()}`}
            inputMode="numeric"
            maxLength={11}
            style={{
              width: '100%', padding: '13px 44px 13px 14px', borderRadius: 12,
              border: `1.5px solid ${error ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}`,
              background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 16,
              fontFamily: "'IBM Plex Mono', monospace", outline: 'none',
              boxSizing: 'border-box' as const, letterSpacing: '.1em', transition: 'border-color .15s',
            }}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(83,230,212,0.4)'; }}
            onBlur={e => { if (!error) (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
          <button onClick={() => setShow(s => !s)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(244,247,247,0.4)', cursor: 'pointer' }}>
            {show ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
          </button>
        </div>

        {/* Character counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          {error
            ? <p style={{ fontSize: 11, color: '#f87171' }}>{error}</p>
            : <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.3)' }}>11 digits required</p>
          }
          <p style={{ fontSize: 11, color: value.length === 11 ? '#4ade80' : 'rgba(244,247,247,0.3)', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
            {value.length}/11
          </p>
        </div>

        {/* Consent checkbox */}
        <div
          onClick={() => setAgreed(a => !a)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: agreed ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${agreed ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.07)'}`, marginBottom: 20, cursor: 'pointer', transition: 'all .15s' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${agreed ? '#4ade80' : 'rgba(255,255,255,0.2)'}`, background: agreed ? '#4ade80' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all .15s' }}>
            {agreed && <Check style={{ width: 11, height: 11, color: '#0D2E2E' }} />}
          </div>
          <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.55)', lineHeight: 1.6 }}>
            I consent to the collection and verification of my {idType.toUpperCase()} for account creation in compliance with CBN KYC regulations. This data is secured and encrypted.
          </p>
        </div>

        {/* Security note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}>
          <Lock style={{ width: 12, height: 12, color: 'rgba(244,247,247,0.3)' }} />
          <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.3)' }}>
            256-bit encrypted · Never stored in plain text · CBN Compliant
          </p>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading || value.length !== 11 || !agreed}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14,
            background: loading || value.length !== 11 || !agreed ? 'rgba(255,255,255,0.06)' : '#53E6D4',
            border: 'none',
            color: loading || value.length !== 11 || !agreed ? 'rgba(244,247,247,0.25)' : '#0D2E2E',
            fontSize: 14, fontWeight: 800, cursor: loading || value.length !== 11 || !agreed ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: "'Sora', sans-serif", transition: 'all .15s',
          }}>
          {loading
            ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin .8s linear infinite' }} /> Verifying…</>
            : <><ShieldCheck style={{ width: 15, height: 15 }} /> Verify & Create Account</>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FundWallet() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet]               = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [amount, setAmount]               = useState('');
  const [loading, setLoading]             = useState(true);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [activeTab, setActiveTab]         = useState<'transfer' | 'card'>('transfer');
  const [copied, setCopied]               = useState<string | null>(null);
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  const [profile, setProfile]             = useState<any>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [showBvnModal, setShowBvnModal]   = useState(false);

  const numAmount = Number(amount) || 0;
  const canPay    = numAmount >= 100 && paystackLoaded && !isProcessing;

  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v1/inline.js';
    s.async = true;
    s.onload = () => setPaystackLoaded(true);
    document.body.appendChild(s);
    return () => { if (document.body.contains(s)) document.body.removeChild(s); };
  }, []);

  const loadData = async () => {
    if (!session?.user?.id) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (p) setProfile(p);
    const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', session.user.id).single();
    if (w) setWallet(w);
    const { data: t } = await supabase.from('transactions').select('*')
      .eq('user_id', session.user.id).eq('type', 'deposit')
      .order('created_at', { ascending: false }).limit(5);
    if (t) setTransactions(t);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    loadData();
    const ch = supabase.channel('wallet_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${session.user.id}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, sessionLoading, router]);

  // ── Called when user submits BVN/NIN ──────────────────────────────────────
  async function createVirtualAccount(idType: 'bvn' | 'nin', idValue: string) {
    setCreatingAccount(true);
    try {
      const res  = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session!.user.id,
          idType,
          idValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Virtual account created! 🎉');
        setShowBvnModal(false);
        loadData();
      } else {
        toast.error(data.message || 'Failed to create account');
      }
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setCreatingAccount(false);
    }
  }

  const handlePaystack = async () => {
    if (numAmount < 100)                        return toast.error('Minimum funding amount is ₦100');
    if (!paystackLoaded || !window.PaystackPop) return toast.error('Payment system loading. Try again.');

    setIsProcessing(true);
    const reference = `DS_FUND_${Date.now()}`;

    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: session!.user.id, amount: numAmount, reference, status: 'pending', type: 'deposit',
    });

    if (insertError) { toast.error('Failed to create transaction'); setIsProcessing(false); return; }

    const handler = window.PaystackPop.setup({
      key:      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email:    session!.user.email!,
      amount:   numAmount * 100,
      currency: 'NGN',
      ref:      reference,
      callback: function (response: any) {
        if (isPaymentLocked(reference)) return;
        lockPayment(reference);
        (async () => {
          try {
            const { error } = await supabase.from('transactions').update({ status: 'success' }).eq('reference', reference).eq('status', 'pending');
            if (error) throw error;
            toast.success('Payment successful! Balance updated 🎉');
            setAmount('');
            loadData();
            setTimeout(() => unlockPayment(reference), 30000);
          } catch { toast.error('Error updating wallet. Contact support.'); unlockPayment(reference); }
          finally { setIsProcessing(false); }
        })();
      },
      onClose: () => { setIsProcessing(false); },
    });

    handler.openIframe();
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied!');
    setTimeout(() => setCopied(null), 2000);
  };

  if (sessionLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#0D2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 38, height: 38, border: '3px solid rgba(83,230,212,.2)', borderTopColor: '#53E6D4', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(83,230,212,.45)', fontSize: 12, fontFamily: 'Sora,sans-serif', fontWeight: 600 }}>Loading…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const hasVirtualAccount = profile?.virtual_accounts && Array.isArray(profile.virtual_accounts) && profile.virtual_accounts.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --primary: #0D2E2E; --carbon: #080C0C; --mint: #53E6D4;
          --gray: #F4F7F7; --mint-dim: rgba(83,230,212,0.12);
          --mint-border: rgba(83,230,212,0.22); --mint-glow: rgba(83,230,212,0.30);
          --muted: rgba(244,247,247,0.40); --border: rgba(255,255,255,0.07);
          --font: 'Sora', sans-serif; --mono: 'IBM Plex Mono', monospace;
        }
        body { background: var(--primary); font-family: var(--font); -webkit-font-smoothing: antialiased; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:.45;} }
        .a1{animation:fadeUp .3s ease .04s both;} .a2{animation:fadeUp .3s ease .09s both;}
        .a3{animation:fadeUp .3s ease .14s both;} .a4{animation:fadeUp .3s ease .19s both;}
        .a5{animation:fadeUp .3s ease .24s both;}
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        input[type=number] { -moz-appearance:textfield; }
        .back-link { transition:color .14s; } .back-link:hover { color:var(--gray) !important; }
        .back-link:hover .arrow { transform:translateX(-3px); } .arrow { transition:transform .14s; }
        .tab-btn { transition:all .16s ease; cursor:pointer; border:none; outline:none; }
        .chip { transition:all .13s ease; cursor:pointer; border:none; outline:none; }
        .chip:hover { border-color:var(--mint-border) !important; background:var(--mint-dim) !important; color:var(--mint) !important; }
        .chip:active { transform:scale(.93); }
        .pay-btn { transition:all .18s ease; cursor:pointer; border:none; outline:none; }
        .pay-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 16px 40px var(--mint-glow) !important; }
        .pay-btn:active:not(:disabled) { transform:scale(.97); }
        .copy-btn { transition:all .14s ease; cursor:pointer; border:none; outline:none; }
        .copy-btn:hover { background:rgba(83,230,212,.18) !important; }
        .tx-row { transition:background .13s; } .tx-row:hover { background:rgba(83,230,212,.03) !important; }
        .amt-box:focus-within { border-color:var(--mint-border) !important; }
        .create-btn { transition:all .18s ease; }
        .create-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 32px var(--mint-glow); }
        .wallet-card {
          background: linear-gradient(135deg, #0a2424 0%, #0d2e2e 50%, #102828 100%);
          position: relative; overflow: hidden;
        }
        .wallet-card::before {
          content:''; position:absolute; top:-40px; right:-40px; width:160px; height:160px;
          border-radius:50%; background:radial-gradient(circle,rgba(83,230,212,0.1) 0%,transparent 70%); pointer-events:none;
        }
      `}</style>

      {/* BVN/NIN Modal */}
      {showBvnModal && (
        <BvnNinModal
          onSubmit={createVirtualAccount}
          onClose={() => { if (!creatingAccount) setShowBvnModal(false); }}
          loading={creatingAccount}
        />
      )}

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)' }}>

        {/* NAV */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,230,212,.08)' }}>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/dashboard" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft className="arrow" style={{ width: 16, height: 16 }} /> Back
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint)', animation: 'pulse 2.5s ease infinite', display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray)' }}>Fund Wallet</span>
            </div>
            <Link href="/dashboard/transactions" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mint)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <Clock style={{ width: 13, height: 13 }} /> History
            </Link>
          </div>
        </nav>

        <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px 110px' }}>

          {/* WALLET CARD */}
          <div className="a1 wallet-card" style={{ borderRadius: 22, padding: '24px', marginBottom: 20, border: '1px solid rgba(83,230,212,.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet style={{ width: 16, height: 16, color: 'var(--mint)' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.14em', textTransform: 'uppercase' }}>Available Balance</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(83,230,212,.1)', border: '1px solid rgba(83,230,212,.18)', borderRadius: 20, padding: '4px 10px' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s ease infinite' }} />
                <span style={{ fontSize: 9, fontWeight: 800, color: '#4ade80', letterSpacing: '.08em', textTransform: 'uppercase' }}>Live</span>
              </div>
            </div>
            {isProcessing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <div style={{ width: 20, height: 20, border: '2px solid rgba(83,230,212,.3)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                <span style={{ fontSize: 14, color: 'rgba(83,230,212,.7)', fontWeight: 600 }}>Processing…</span>
              </div>
            ) : (
              <p style={{ fontSize: 36, fontWeight: 900, color: 'var(--gray)', fontFamily: 'var(--mono)', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 4 }}>
                ₦{fmt(wallet?.balance ?? 0)}
              </p>
            )}
            <p style={{ fontSize: 11, color: 'rgba(244,247,247,.25)', marginTop: 6 }}>DashSub Wallet · Instant top-up available</p>
          </div>

          {/* TRUST BADGES */}
          <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {[
              { Icon: ShieldCheck, label: 'SSL Secured',    sub: '256-bit encryption' },
              { Icon: Zap,         label: 'Instant Credit', sub: 'Real-time update'   },
              { Icon: BadgeCheck,  label: 'CBN Compliant',  sub: 'KYC Verified'       },
            ].map(({ Icon, label, sub }, i) => (
              <div key={i} style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                <Icon style={{ width: 18, height: 18, color: 'var(--mint)', margin: '0 auto 6px', display: 'block' }} />
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray)', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 9, color: 'var(--muted)' }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* TABS */}
          <div className="a3" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 16, padding: 5, display: 'flex', gap: 5, marginBottom: 18 }}>
            {[
              { id: 'transfer', label: 'Bank Transfer', Icon: Landmark   },
              { id: 'card',     label: 'Card / Online', Icon: CreditCard },
            ].map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} className="tab-btn" onClick={() => setActiveTab(id as any)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 12px', borderRadius: 12, background: active ? 'var(--mint)' : 'transparent', color: active ? 'var(--carbon)' : 'var(--muted)', fontSize: 13, fontWeight: 800 }}>
                  <Icon style={{ width: 15, height: 15 }} /> {label}
                </button>
              );
            })}
          </div>

          {/* BANK TRANSFER TAB */}
          {activeTab === 'transfer' && (
            <div className="a4">
              {hasVirtualAccount ? (
                <>
                  <div style={{ background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10 }}>
                    <AlertCircle style={{ width: 15, height: 15, color: 'var(--mint)', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 11, color: 'rgba(83,230,212,.8)', lineHeight: 1.6 }}>
                      Transfer any amount to any of the accounts below. Your wallet updates instantly after confirmation.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {profile.virtual_accounts.map((acc: any, i: number) => (
                      <div key={i} style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 18, padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Landmark style={{ width: 16, height: 16, color: 'var(--mint)' }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>{acc.bankName}</span>
                          </div>
                          <span style={{ background: 'rgba(74,222,128,.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,.2)', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase' }}>Active</span>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 5 }}>Account Number</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--gray)', letterSpacing: '.05em' }}>{acc.accountNumber}</p>
                            <button className="copy-btn" onClick={() => copyText(acc.accountNumber, `acc-${i}`)}
                              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(83,230,212,.08)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {copied === `acc-${i}` ? <Check style={{ width: 15, height: 15, color: 'var(--mint)' }} /> : <Copy style={{ width: 15, height: 15, color: 'var(--mint)' }} />}
                            </button>
                          </div>
                        </div>
                        <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Account Name</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(244,247,247,.7)' }}>{acc.accountName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock style={{ width: 11, height: 11, color: 'rgba(83,230,212,.4)' }} />
                    <p style={{ fontSize: 10, color: 'rgba(244,247,247,.25)' }}>Unique to your profile. Do not share.</p>
                  </div>
                </>
              ) : (
                /* No virtual account — show create prompt with BVN/NIN requirement */
                <div style={{ background: 'var(--carbon)', border: '1px dashed rgba(83,230,212,.2)', borderRadius: 18, padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--mint-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid var(--mint-border)' }}>
                    <Landmark style={{ width: 26, height: 26, color: 'var(--mint)' }} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray)', marginBottom: 8 }}>Get Your Virtual Account</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.7, maxWidth: 280, margin: '0 auto 20px' }}>
                    Create a dedicated bank account to fund your wallet instantly via transfer — no fees, reflects in seconds.
                  </p>

                  {/* Requirements list */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>What you'll need</p>
                    {[
                      { icon: Shield, text: 'BVN or NIN (11 digits)', color: '#53E6D4' },
                      { icon: BadgeCheck, text: 'CBN KYC compliance', color: '#4ade80' },
                      { icon: Zap, text: 'Takes less than 30 seconds', color: '#FACC15' },
                    ].map(({ icon: Icon, text, color }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 8 : 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon style={{ width: 13, height: 13, color }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'rgba(244,247,247,0.6)', fontWeight: 600 }}>{text}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="create-btn"
                    onClick={() => setShowBvnModal(true)}
                    style={{ background: 'var(--mint)', color: 'var(--carbon)', border: 'none', borderRadius: 14, padding: '13px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 20px var(--mint-glow)', fontFamily: 'var(--font)' }}>
                    <Shield style={{ width: 15, height: 15 }} />
                    Verify & Create Account
                    <ChevronRight style={{ width: 14, height: 14 }} />
                  </button>

                  <p style={{ fontSize: 10, color: 'rgba(244,247,247,0.25)', marginTop: 14 }}>
                    Your BVN/NIN is encrypted and never shared with third parties
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CARD TAB */}
          {activeTab === 'card' && (
            <div className="a4">
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '20px' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                  Amount to Fund
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {QUICK_AMOUNTS.map((q) => {
                    const active = amount === q.toString();
                    return (
                      <button key={q} className="chip" onClick={() => setAmount(q.toString())}
                        style={{ background: active ? 'var(--mint-dim)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'var(--mint-border)' : 'var(--border)'}`, borderRadius: 11, padding: '10px 0', color: active ? 'var(--mint)' : 'rgba(244,247,247,.5)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        ₦{fmtShort(q)}
                      </button>
                    );
                  })}
                </div>
                <div className="amt-box" style={{ background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)', borderRadius: 13, display: 'flex', alignItems: 'center', padding: '0 14px', marginBottom: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(244,247,247,.2)', marginRight: 4 }}>₦</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" min="100"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray)', fontSize: 17, fontWeight: 700, fontFamily: 'var(--mono)', padding: '14px 0' }} />
                </div>
                <p style={{ fontSize: 10, color: 'rgba(244,247,247,.2)', marginBottom: 18 }}>Minimum ₦100 · Powered by Paystack</p>
                <button className="pay-btn" onClick={handlePaystack} disabled={!canPay}
                  style={{ width: '100%', background: canPay ? 'var(--mint)' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 14, height: 54, color: canPay ? 'var(--carbon)' : 'rgba(244,247,247,.2)', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: canPay ? '0 6px 24px var(--mint-glow)' : 'none' }}>
                  {isProcessing
                    ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(8,12,12,.3)', borderTopColor: 'var(--carbon)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Processing…</>
                    : !paystackLoaded
                    ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(244,247,247,.2)', borderTopColor: 'rgba(244,247,247,.5)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Loading…</>
                    : <><ShieldCheck style={{ width: 17, height: 17 }} /> Pay Securely — ₦{numAmount >= 100 ? fmtShort(numAmount) : '—'}</>
                  }
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                  <Lock style={{ width: 11, height: 11, color: 'rgba(244,247,247,.2)' }} />
                  <span style={{ fontSize: 10, color: 'rgba(244,247,247,.2)' }}>Secured by Paystack · Card details never stored</span>
                </div>
              </div>
            </div>
          )}

          {/* RECENT DEPOSITS */}
          <div className="a5" style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Recent Deposits</span>
              <Link href="/dashboard/transactions" style={{ fontSize: 12, color: 'var(--mint)', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                See all <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
            <div style={{ background: 'var(--carbon)', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.05)' }}>
              {transactions.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <History style={{ width: 19, height: 19, color: 'rgba(244,247,247,.16)', display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,.28)' }}>No deposits yet</p>
                </div>
              ) : (
                transactions.map((tx, i) => {
                  const ok = tx.status === 'completed' || tx.status === 'success';
                  const pend = tx.status === 'pending';
                  return (
                    <div key={tx.id} className="tx-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Wallet style={{ width: 16, height: 16, color: '#4ade80' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)', marginBottom: 2 }}>Wallet Deposit</p>
                        <p style={{ fontSize: 10, color: 'rgba(244,247,247,.25)', fontFamily: 'var(--mono)' }}>
                          {new Date(tx.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', fontFamily: 'var(--mono)', marginBottom: 4 }}>+₦{fmtShort(tx.amount)}</p>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', padding: '3px 7px', borderRadius: 5, background: ok ? 'rgba(34,197,94,.1)' : pend ? 'rgba(250,204,21,.1)' : 'rgba(239,68,68,.1)', color: ok ? '#4ade80' : pend ? '#facc15' : '#f87171', border: `1px solid ${ok ? 'rgba(34,197,94,.18)' : pend ? 'rgba(250,204,21,.18)' : 'rgba(239,68,68,.18)'}` }}>
                          {ok ? 'Successful' : tx.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}