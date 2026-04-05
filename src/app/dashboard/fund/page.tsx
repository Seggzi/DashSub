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

declare global {
  interface Window { PaystackPop: any; }
}

const isPaymentLocked  = (ref: string) => typeof window !== 'undefined' && localStorage.getItem(`payment_lock_${ref}`) === 'true';
const lockPayment      = (ref: string) => typeof window !== 'undefined' && localStorage.setItem(`payment_lock_${ref}`, 'true');
const unlockPayment    = (ref: string) => typeof window !== 'undefined' && localStorage.removeItem(`payment_lock_${ref}`);

const fmt      = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
const fmtShort = (n: number) => n.toLocaleString('en-NG');

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

export default function FundWallet() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet]           = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab]     = useState<'transfer' | 'card'>('transfer');
  const [copied, setCopied]           = useState<string | null>(null);
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  const [profile, setProfile]         = useState<any>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const numAmount = Number(amount) || 0;
  const canPay    = numAmount >= 100 && paystackLoaded && !isProcessing;

  /* ── Paystack script ── */
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v1/inline.js';
    s.async = true;
    s.onload = () => setPaystackLoaded(true);
    document.body.appendChild(s);
    return () => { if (document.body.contains(s)) document.body.removeChild(s); };
  }, []);

  /* ── Load data ── */
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

  /* ── Create virtual account ── */
  const createVirtualAccount = async () => {
    setCreatingAccount(true);
    try {
      const res  = await fetch('/api/create-virtual-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: session!.user.id }) });
      const data = await res.json();
      if (data.success) { toast.success('Virtual account created! 🎉'); loadData(); }
      else toast.error(data.message || 'Failed to create account');
    } catch { toast.error('An error occurred'); }
    finally { setCreatingAccount(false); }
  };

  /* ── Paystack payment ── */
  const handlePaystack = async () => {
    if (numAmount < 100)                          return toast.error('Minimum funding amount is ₦100');
    if (!paystackLoaded || !window.PaystackPop)   return toast.error('Payment system loading. Try again.');

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
    </div>
  );

  const hasVirtualAccount = profile?.monnify_accounts && Array.isArray(profile.monnify_accounts) && profile.monnify_accounts.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --primary:     #0D2E2E;
          --primary-mid: #122f2f;
          --carbon:      #080C0C;
          --mint:        #53E6D4;
          --gray:        #F4F7F7;
          --mint-dim:    rgba(83,230,212,0.12);
          --mint-border: rgba(83,230,212,0.22);
          --mint-glow:   rgba(83,230,212,0.30);
          --muted:       rgba(244,247,247,0.40);
          --border:      rgba(255,255,255,0.07);
          --font: 'Sora', sans-serif;
          --mono: 'IBM Plex Mono', monospace;
        }

        body { background: var(--primary); font-family: var(--font); -webkit-font-smoothing: antialiased; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes pulse   { 0%,100%{opacity:1;} 50%{opacity:.45;} }
        @keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }

        .a1{animation:fadeUp .3s ease .04s both;}
        .a2{animation:fadeUp .3s ease .09s both;}
        .a3{animation:fadeUp .3s ease .14s both;}
        .a4{animation:fadeUp .3s ease .19s both;}
        .a5{animation:fadeUp .3s ease .24s both;}

        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        input[type=number] { -moz-appearance:textfield; }

        .back-link { transition:color .14s; }
        .back-link:hover { color:var(--gray) !important; }
        .back-link:hover .arrow { transform:translateX(-3px); }
        .arrow { transition:transform .14s; }

        .tab-btn { transition:all .16s ease; cursor:pointer; border:none; outline:none; }

        .chip { transition:all .13s ease; cursor:pointer; border:none; outline:none; }
        .chip:hover { border-color:var(--mint-border) !important; background:var(--mint-dim) !important; color:var(--mint) !important; }
        .chip:active { transform:scale(.93); }

        .pay-btn { transition:all .18s ease; cursor:pointer; border:none; outline:none; }
        .pay-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 16px 40px var(--mint-glow) !important; }
        .pay-btn:active:not(:disabled) { transform:scale(.97); }

        .copy-btn { transition:all .14s ease; cursor:pointer; border:none; outline:none; }
        .copy-btn:hover { background:rgba(83,230,212,.18) !important; }

        .tx-row { transition:background .13s; }
        .tx-row:hover { background:rgba(83,230,212,.03) !important; }

        .amt-box:focus-within { border-color:var(--mint-border) !important; }

        /* wallet card shimmer */
        .wallet-card {
          background: linear-gradient(135deg, #0a2424 0%, #0d2e2e 50%, #102828 100%);
          position: relative;
          overflow: hidden;
        }
        .wallet-card::before {
          content: '';
          position: absolute;
          top: -40px; right: -40px;
          width: 160px; height: 160px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(83,230,212,0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .wallet-card::after {
          content: '';
          position: absolute;
          bottom: -30px; left: -30px;
          width: 120px; height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(83,230,212,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)' }}>

        {/* ─── NAV ─── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,230,212,.08)' }}>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/dashboard" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft className="arrow" style={{ width: 16, height: 16 }} />
              Back
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint)', boxShadow: '0 0 8px var(--mint-glow)', display: 'inline-block', animation: 'pulse 2.5s ease infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--gray)' }}>Fund Wallet</span>
            </div>
            <Link href="/dashboard/transactions" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mint)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <Clock style={{ width: 13, height: 13 }} />
              History
            </Link>
          </div>
        </nav>

        <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px 110px' }}>

          {/* ── WALLET CARD ── */}
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
                <span style={{ fontSize: 14, color: 'rgba(83,230,212,.7)', fontWeight: 600 }}>Processing payment…</span>
              </div>
            ) : (
              <p style={{ fontSize: 36, fontWeight: 900, color: 'var(--gray)', fontFamily: 'var(--mono)', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 4 }}>
                ₦{fmt(wallet?.balance ?? 0)}
              </p>
            )}
            <p style={{ fontSize: 11, color: 'rgba(244,247,247,.25)', marginTop: 6, fontWeight: 500 }}>
              DashSub Wallet · Instant top-up available
            </p>
          </div>

          {/* ── TRUST BADGES ── */}
          <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {[
              { Icon: ShieldCheck, label: 'SSL Secured',   sub: '256-bit encryption' },
              { Icon: Zap,         label: 'Instant Credit', sub: 'Real-time update'  },
              { Icon: BadgeCheck,  label: 'Verified',      sub: 'CBN Compliant'      },
            ].map(({ Icon, label, sub }, i) => (
              <div key={i} style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                <Icon style={{ width: 18, height: 18, color: 'var(--mint)', margin: '0 auto 6px', display: 'block' }} />
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray)', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 500 }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* ── TABS ── */}
          <div className="a3" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 16, padding: 5, display: 'flex', gap: 5, marginBottom: 18 }}>
            {[
              { id: 'transfer', label: 'Bank Transfer', Icon: Landmark   },
              { id: 'card',     label: 'Card / Online', Icon: CreditCard },
            ].map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} className="tab-btn"
                  onClick={() => setActiveTab(id as any)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 12px', borderRadius: 12, background: active ? 'var(--mint)' : 'transparent', color: active ? 'var(--carbon)' : 'var(--muted)', fontSize: 13, fontWeight: 800 }}
                >
                  <Icon style={{ width: 15, height: 15 }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* ══════════════════ BANK TRANSFER TAB ══════════════════ */}
          {activeTab === 'transfer' && (
            <div className="a4">
              {hasVirtualAccount ? (
                <>
                  {/* How it works */}
                  <div style={{ background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertCircle style={{ width: 15, height: 15, color: 'var(--mint)', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 11, color: 'rgba(83,230,212,.8)', fontWeight: 500, lineHeight: 1.6 }}>
                      Transfer any amount to any of the accounts below. Your DashSub wallet updates instantly after the transfer is confirmed.
                    </p>
                  </div>

                  {/* Account cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {profile.monnify_accounts.map((acc: any, i: number) => (
                      <div key={i} style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 18, padding: '20px' }}>
                        {/* Bank name + badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Landmark style={{ width: 16, height: 16, color: 'var(--mint)' }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>{acc.bankName}</span>
                          </div>
                          <span style={{ background: 'rgba(74,222,128,.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,.2)', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.06em' }}>Active</span>
                        </div>

                        {/* Account number */}
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 5 }}>Account Number</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--gray)', letterSpacing: '.05em' }}>{acc.accountNumber}</p>
                            <button className="copy-btn" onClick={() => copyText(acc.accountNumber, `acc-${i}`)}
                              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(83,230,212,.08)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .14s' }}>
                              {copied === `acc-${i}` ? <Check style={{ width: 15, height: 15, color: 'var(--mint)' }} /> : <Copy style={{ width: 15, height: 15, color: 'var(--mint)' }} />}
                            </button>
                          </div>
                        </div>

                        {/* Account name */}
                        <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Account Name</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(244,247,247,.7)' }}>{acc.accountName}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Note */}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock style={{ width: 11, height: 11, color: 'rgba(83,230,212,.4)' }} />
                    <p style={{ fontSize: 10, color: 'rgba(244,247,247,.25)', fontWeight: 500 }}>
                      These accounts are unique to your DashSub profile. Do not share with others.
                    </p>
                  </div>
                </>
              ) : (
                /* No virtual account yet */
                <div style={{ background: 'var(--carbon)', border: '1px dashed rgba(83,230,212,.2)', borderRadius: 18, padding: '36px 20px', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--mint-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '1px solid var(--mint-border)' }}>
                    <Landmark style={{ width: 24, height: 24, color: 'var(--mint)' }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray)', marginBottom: 6 }}>No Virtual Account Yet</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Create a dedicated bank account to fund your wallet instantly via transfer.
                  </p>
                  <button onClick={createVirtualAccount} disabled={creatingAccount}
                    style={{ background: 'var(--mint)', color: 'var(--carbon)', border: 'none', borderRadius: 13, padding: '12px 24px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 20px var(--mint-glow)', opacity: creatingAccount ? .7 : 1, transition: 'all .16s', fontFamily: 'var(--font)' }}>
                    {creatingAccount
                      ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(8,12,12,.3)', borderTopColor: 'var(--carbon)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Creating…</>
                      : <><Landmark style={{ width: 15, height: 15 }} /> Create Virtual Account</>
                    }
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════ CARD / ONLINE TAB ══════════════════ */}
          {activeTab === 'card' && (
            <div className="a4">
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '20px' }}>

                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                  Amount to Fund
                </label>

                {/* Quick amounts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {QUICK_AMOUNTS.map((q) => {
                    const active = amount === q.toString();
                    return (
                      <button key={q} className="chip"
                        onClick={() => setAmount(q.toString())}
                        style={{ background: active ? 'var(--mint-dim)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'var(--mint-border)' : 'var(--border)'}`, borderRadius: 11, padding: '10px 0', color: active ? 'var(--mint)' : 'rgba(244,247,247,.5)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        ₦{fmtShort(q)}
                      </button>
                    );
                  })}
                </div>

                {/* Custom amount */}
                <div className="amt-box" style={{ background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)', borderRadius: 13, display: 'flex', alignItems: 'center', padding: '0 14px', marginBottom: 6, transition: 'border-color .2s' }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(244,247,247,.2)', marginRight: 4 }}>₦</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="100"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray)', fontSize: 17, fontWeight: 700, fontFamily: 'var(--mono)', padding: '14px 0' }}
                  />
                </div>
                <p style={{ fontSize: 10, color: 'rgba(244,247,247,.2)', marginBottom: 18 }}>Minimum ₦100 · Powered by Paystack</p>

                {/* Pay button */}
                <button className="pay-btn" onClick={handlePaystack} disabled={!canPay}
                  style={{ width: '100%', background: canPay ? 'var(--mint)' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 14, height: 54, color: canPay ? 'var(--carbon)' : 'rgba(244,247,247,.2)', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: canPay ? '0 6px 24px var(--mint-glow)' : 'none', letterSpacing: '-.01em' }}>
                  {isProcessing
                    ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(8,12,12,.3)', borderTopColor: 'var(--carbon)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Processing…</>
                    : !paystackLoaded
                    ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(244,247,247,.2)', borderTopColor: 'rgba(244,247,247,.5)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Loading…</>
                    : <><ShieldCheck style={{ width: 17, height: 17 }} /> Pay Securely — ₦{numAmount >= 100 ? fmtShort(numAmount) : '—'}</>
                  }
                </button>

                {/* Paystack trust note */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                  <Lock style={{ width: 11, height: 11, color: 'rgba(244,247,247,.2)' }} />
                  <span style={{ fontSize: 10, color: 'rgba(244,247,247,.2)', fontWeight: 500 }}>
                    Secured by Paystack · Card details never stored
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── RECENT DEPOSITS ── */}
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
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <History style={{ width: 19, height: 19, color: 'rgba(244,247,247,.16)' }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,.28)', fontWeight: 500 }}>No deposits yet</p>
                  <p style={{ fontSize: 11, color: 'rgba(244,247,247,.16)', marginTop: 4 }}>Your funding history will appear here</p>
                </div>
              ) : (
                transactions.map((tx, i) => {
                  const ok   = tx.status === 'completed' || tx.status === 'success';
                  const pend = tx.status === 'pending';
                  return (
                    <div key={tx.id} className="tx-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Wallet style={{ width: 16, height: 16, color: '#4ade80' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)', marginBottom: 2 }}>Wallet Deposit</p>
                        <p style={{ fontSize: 10, color: 'rgba(244,247,247,.25)', fontFamily: 'var(--mono)' }}>
                          {new Date(tx.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', fontFamily: 'var(--mono)', marginBottom: 4 }}>+₦{fmtShort(tx.amount)}</p>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 7px', borderRadius: 5, background: ok ? 'rgba(34,197,94,.1)' : pend ? 'rgba(250,204,21,.1)' : 'rgba(239,68,68,.1)', color: ok ? '#4ade80' : pend ? '#facc15' : '#f87171', border: `1px solid ${ok ? 'rgba(34,197,94,.18)' : pend ? 'rgba(250,204,21,.18)' : 'rgba(239,68,68,.18)'}` }}>
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