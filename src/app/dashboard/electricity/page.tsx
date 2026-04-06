'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap, ArrowLeft, Wallet, Loader2, CheckCircle2,
  Clock, X, User, ShieldCheck, ChevronRight,
  ArrowRight, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  reference: string;
  type: string;
  phone_number?: string;
  metadata?: any;
}

/* ── All Nigerian DISCOs ── */
const DISCOS = [
  { id: 'ikeja-electric',    name: 'IKEDC',   fullName: 'Ikeja Electric',              color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.28)'  },
  { id: 'eko-electric',      name: 'EKEDC',   fullName: 'Eko Electric',                color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.28)'  },
  { id: 'kano-electric',     name: 'KEDC',    fullName: 'Kano Electric',               color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.28)'  },
  { id: 'portharcourt-electric', name: 'PHEDC', fullName: 'Port Harcourt Electric',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)'   },
  { id: 'jos-electric',      name: 'JED',     fullName: 'Jos Electric',                color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.28)'  },
  { id: 'ibadan-electric',   name: 'IBEDC',   fullName: 'Ibadan Electric',             color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.28)'  },
  { id: 'kaduna-electric',   name: 'KAEDCO',  fullName: 'Kaduna Electric',             color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.28)'   },
  { id: 'abuja-electric',    name: 'AEDC',    fullName: 'Abuja Electric',              color: '#53E6D4', bg: 'rgba(83,230,212,0.12)',  border: 'rgba(83,230,212,0.28)'  },
  { id: 'enugu-electric',    name: 'EEDC',    fullName: 'Enugu Electric',              color: '#84cc16', bg: 'rgba(132,204,22,0.12)',  border: 'rgba(132,204,22,0.28)'  },
  { id: 'benin-electric',    name: 'BEDC',    fullName: 'Benin Electric',              color: '#ec4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.28)'  },
];

const QUICK_AMOUNTS = [1000, 2000, 3000, 5000, 10000, 20000];

const fmt      = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
const fmtShort = (n: number) => n.toLocaleString('en-NG');

export default function BuyElectricity() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet]               = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [selectedDisco, setSelectedDisco] = useState<string | null>(null);
  const [meterType, setMeterType]         = useState<'prepaid' | 'postpaid'>('prepaid');
  const [meterNumber, setMeterNumber]     = useState('');
  const [phone, setPhone]                 = useState('');
  const [amount, setAmount]               = useState('');
  const [customerName, setCustomerName]   = useState('');
  const [verifying, setVerifying]         = useState(false);
  const [verified, setVerified]           = useState(false);
  const [loading, setLoading]             = useState(true);
  const [isPurchasing, setIsPurchasing]   = useState(false);
  const [showSheet, setShowSheet]         = useState(false);
  const [successToken, setSuccessToken]   = useState('');
  const [copied, setCopied]               = useState(false);

  const numAmount = Number(amount) || 0;
  const selDisco  = DISCOS.find(d => d.id === selectedDisco);
  const canPay    = !!selectedDisco && verified && phone.length === 11 && numAmount >= 500;

  /* ── Load data ── */
  const loadData = async () => {
    if (!session?.user?.id) return;
    const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', session.user.id).single();
    if (w) setWallet(w);
    const { data: t } = await supabase.from('transactions').select('*')
      .eq('user_id', session.user.id).eq('type', 'electricity')
      .order('created_at', { ascending: false }).limit(5);
    if (t) setTransactions(t);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    loadData();
    const ch = supabase.channel('wallet_elec')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${session.user.id}` },
        (p) => { if (p.new && 'balance' in p.new) setWallet({ balance: p.new.balance as number }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, sessionLoading, router]);

  /* ── Scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = showSheet ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSheet]);

  /* ── Reset verification when meter/disco/type changes ── */
  useEffect(() => {
    setVerified(false);
    setCustomerName('');
  }, [meterNumber, selectedDisco, meterType]);

  /* ── Auto-verify when meter number is 11+ digits ── */
  useEffect(() => {
    if (meterNumber.length >= 11 && selectedDisco && !verified) {
      handleVerifyMeter();
    }
  }, [meterNumber, selectedDisco, meterType]);

  const handleVerifyMeter = async () => {
    if (!meterNumber || meterNumber.length < 11 || !selectedDisco) return;
    setVerifying(true);
    setVerified(false);
    setCustomerName('');
    try {
      const res  = await fetch('/api/verify-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterNumber, discoCode: selectedDisco, meterType }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomerName(data.customerName);
        setVerified(true);
        toast.success(`Meter verified: ${data.customerName}`);
      } else {
        toast.error(data.message || 'Meter verification failed');
      }
    } catch { toast.error('Could not verify meter'); }
    finally { setVerifying(false); }
  };

  const handleContinue = () => {
    if (!selectedDisco)          return toast.error('Select a DISCO');
    if (!verified)               return toast.error('Verify your meter number first');
    if (phone.length < 11)       return toast.error('Enter a valid phone number');
    if (numAmount < 500)         return toast.error('Minimum amount is ₦500');
    if (!wallet || wallet.balance < numAmount) return toast.error(`Insufficient balance. Need ₦${fmtShort(numAmount)}`);
    setShowSheet(true);
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const reference = `ELEC_${Date.now()}`;
      const res  = await fetch('/api/purchase-electricity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session!.user.id,
          meterNumber,
          discoCode:  selectedDisco,
          meterType,
          amount:     numAmount,
          phone,
          reference,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessToken(data.token || '');
        toast.success('Electricity purchased successfully! 🎉');
        // Reset form but keep sheet open to show token
        setMeterNumber(''); setPhone(''); setAmount('');
        setSelectedDisco(null); setVerified(false); setCustomerName('');
        loadData();
      } else {
        toast.error(data.message || 'Purchase failed. Try again.');
        setShowSheet(false);
      }
    } catch { toast.error('Something went wrong. Contact support.'); }
    finally { setIsPurchasing(false); }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(successToken);
    setCopied(true);
    toast.success('Token copied!');
    setTimeout(() => setCopied(false), 2500);
  };

  if (sessionLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#0D2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 38, height: 38, border: '3px solid rgba(83,230,212,.2)', borderTopColor: '#53E6D4', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(83,230,212,.45)', fontSize: 12, fontFamily: 'Sora,sans-serif', fontWeight: 600 }}>Loading…</p>
      </div>
    </div>
  );

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
        @keyframes sheetUp { from{transform:translateY(100%);} to{transform:translateY(0);} }
        @keyframes scrim   { from{opacity:0;} to{opacity:1;} }
        @keyframes blink   { 0%,100%{opacity:1;} 50%{opacity:.4;} }
        @keyframes popIn   { from{transform:scale(.7);opacity:0;} to{transform:scale(1);opacity:1;} }
        .a1{animation:fadeUp .3s ease .04s both;}
        .a2{animation:fadeUp .3s ease .09s both;}
        .a3{animation:fadeUp .3s ease .14s both;}
        .a4{animation:fadeUp .3s ease .19s both;}
        .a5{animation:fadeUp .3s ease .24s both;}
        .a6{animation:fadeUp .3s ease .29s both;}
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        input[type=number] { -moz-appearance:textfield; }
        .disco-btn { transition:all .15s ease; cursor:pointer; border:none; outline:none; }
        .disco-btn:hover  { transform:translateY(-2px); }
        .disco-btn:active { transform:scale(.93); }
        .chip { transition:all .13s ease; cursor:pointer; border:none; outline:none; }
        .chip:hover  { border-color:var(--mint-border) !important; background:var(--mint-dim) !important; color:var(--mint) !important; }
        .chip:active { transform:scale(.93); }
        .type-btn { transition:all .15s ease; cursor:pointer; border:none; outline:none; }
        .pay-btn { transition:all .18s ease; cursor:pointer; border:none; outline:none; }
        .pay-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 16px 40px var(--mint-glow) !important; }
        .pay-btn:active:not(:disabled) { transform:scale(.97); }
        .confirm-btn { transition:all .15s ease; cursor:pointer; border:none; outline:none; }
        .confirm-btn:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px); }
        .tx-row { transition:background .13s; }
        .tx-row:hover { background:rgba(83,230,212,.03) !important; }
        .back-link { transition:color .14s; }
        .back-link:hover { color:var(--gray) !important; }
        .back-link:hover .arrow { transform:translateX(-3px); }
        .arrow { transition:transform .14s; }
        .input-wrap:focus-within { border-color:var(--mint-border) !important; box-shadow:0 0 0 3px rgba(83,230,212,.07) !important; }
        .amt-box:focus-within { border-color:var(--mint-border) !important; }
        .close-x:hover { background:rgba(255,255,255,.12) !important; }
        .copy-btn:hover { background:rgba(83,230,212,.2) !important; }
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
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint)', boxShadow: '0 0 8px var(--mint-glow)', display: 'inline-block', animation: 'blink 2.5s ease infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--gray)' }}>Buy Electricity</span>
            </div>
            <Link href="/dashboard/transactions" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mint)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <Clock style={{ width: 13, height: 13 }} />
              History
            </Link>
          </div>
        </nav>

        <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px 110px' }}>

          {/* ── WALLET STRIP ── */}
          <div className="a1" style={{ background: 'var(--primary-mid)', border: '1px solid var(--mint-border)', borderRadius: 18, padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet style={{ width: 17, height: 17, color: 'var(--mint)' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 3 }}>Wallet Balance</p>
                <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--gray)' }}>₦{fmt(wallet?.balance ?? 0)}</p>
              </div>
            </div>
            <Link href="/dashboard/fund" style={{ fontSize: 12, fontWeight: 800, color: 'var(--carbon)', textDecoration: 'none', background: 'var(--mint)', padding: '8px 16px', borderRadius: 10, boxShadow: '0 4px 14px var(--mint-glow)' }}>
              + Fund
            </Link>
          </div>

          {/* ── DISCO SELECTOR ── */}
          <div className="a2" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Select DISCO
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {DISCOS.map((disco) => {
                const active = selectedDisco === disco.id;
                return (
                  <button key={disco.id} className="disco-btn"
                    onClick={() => setSelectedDisco(disco.id)}
                    style={{ background: active ? disco.bg : 'var(--carbon)', border: `1.5px solid ${active ? disco.border : 'var(--border)'}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', textAlign: 'left' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? disco.bg : 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap style={{ width: 16, height: 16, color: active ? disco.color : 'rgba(244,247,247,.3)' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 800, color: active ? disco.color : 'var(--gray)' }}>{disco.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{disco.fullName}</p>
                    </div>
                    {active && (
                      <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: disco.color, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'popIn .18s ease' }}>
                        <CheckCircle2 style={{ width: 11, height: 11, color: 'white' }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── METER TYPE ── */}
          <div className="a3" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Meter Type
            </label>
            <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 4, display: 'flex', gap: 4 }}>
              {(['prepaid', 'postpaid'] as const).map((t) => (
                <button key={t} className="type-btn"
                  onClick={() => setMeterType(t)}
                  style={{ flex: 1, padding: '10px', borderRadius: 11, background: meterType === t ? 'var(--mint)' : 'transparent', color: meterType === t ? 'var(--carbon)' : 'var(--muted)', fontSize: 13, fontWeight: 800, textTransform: 'capitalize', fontFamily: 'var(--font)' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── METER NUMBER ── */}
          <div className="a4" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Meter Number
            </label>
            <div className="input-wrap" style={{ background: 'var(--carbon)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', overflow: 'hidden', transition: 'border-color .2s, box-shadow .2s' }}>
              <input
                type="text"
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value.replace(/\D/g, '').slice(0, 13))}
                placeholder="Enter meter number"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray)', fontSize: 16, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '.05em', padding: '0 16px', height: 54 }}
              />
              {/* Verification status */}
              <div style={{ paddingRight: 14, flexShrink: 0 }}>
                {verifying && (
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(83,230,212,.3)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                )}
                {!verifying && verified && (
                  <CheckCircle2 style={{ width: 18, height: 18, color: '#4ade80', animation: 'popIn .2s ease' }} />
                )}
              </div>
            </div>

            {/* Customer name after verification */}
            {customerName && (
              <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 12, height: 12, color: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>{customerName}</span>
              </div>
            )}

            {/* Manual verify button */}
            {meterNumber.length >= 11 && !verified && !verifying && selectedDisco && (
              <button onClick={handleVerifyMeter}
                style={{ marginTop: 8, fontSize: 11, color: 'var(--mint)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0, fontFamily: 'var(--font)' }}>
                Tap to verify meter →
              </button>
            )}
            {!selectedDisco && meterNumber.length > 0 && (
              <p style={{ fontSize: 11, color: '#facc15', marginTop: 7, fontWeight: 600 }}>⚠ Select a DISCO first</p>
            )}
          </div>

          {/* ── PHONE NUMBER ── */}
          <div className="a4" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Phone Number
            </label>
            <div className="input-wrap" style={{ background: 'var(--carbon)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', overflow: 'hidden', transition: 'border-color .2s, box-shadow .2s' }}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="0801 234 5678"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray)', fontSize: 16, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '.05em', padding: '0 16px', height: 54 }}
              />
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: phone.length === 11 ? 'var(--mint)' : 'rgba(244,247,247,.18)', marginRight: 14, flexShrink: 0 }}>
                {phone.length}/11
              </span>
            </div>
          </div>

          {/* ── AMOUNT ── */}
          <div className="a5" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '18px', marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
              Amount
            </label>
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
            <div className="amt-box" style={{ background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)', borderRadius: 13, display: 'flex', alignItems: 'center', padding: '0 14px', transition: 'border-color .2s' }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(244,247,247,.2)', marginRight: 4 }}>₦</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Custom amount" min="500"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', padding: '14px 0' }} />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(244,247,247,.2)', marginTop: 7 }}>Minimum ₦500</p>
          </div>

          {/* ── PAY BUTTON ── */}
          <div className="a6">
            <button className="pay-btn" onClick={handleContinue} disabled={!canPay}
              style={{ width: '100%', background: canPay ? 'var(--mint)' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 14, height: 54, color: canPay ? 'var(--carbon)' : 'rgba(244,247,247,.2)', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: canPay ? '0 6px 24px var(--mint-glow)' : 'none', letterSpacing: '-.01em' }}>
              {canPay
                ? <><Zap style={{ width: 16, height: 16 }} /> Continue — ₦{fmtShort(numAmount)} <ChevronRight style={{ width: 14, height: 14 }} /></>
                : <><Zap style={{ width: 15, height: 15 }} /> Fill in details to continue</>
              }
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 9 }}>
              <ShieldCheck style={{ width: 11, height: 11, color: 'rgba(244,247,247,.18)' }} />
              <span style={{ fontSize: 10, color: 'rgba(244,247,247,.18)', fontWeight: 500 }}>256-bit encrypted · Instant token delivery</span>
            </div>
          </div>

          {/* ── RECENT TRANSACTIONS ── */}
          <div style={{ marginTop: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Recent Purchases</span>
              <Link href="/dashboard/transactions" style={{ fontSize: 12, color: 'var(--mint)', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                See all <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
            <div style={{ background: 'var(--carbon)', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.05)' }}>
              {transactions.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <Zap style={{ width: 19, height: 19, color: 'rgba(244,247,247,.16)' }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,.28)', fontWeight: 500 }}>No purchases yet</p>
                </div>
              ) : (
                transactions.map((tx, i) => {
                  const ok   = tx.status === 'success' || tx.status === 'completed';
                  const pend = tx.status === 'pending';
                  const disco = DISCOS.find(d => d.id === tx.metadata?.discoCode);
                  return (
                    <div key={tx.id} className="tx-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: disco ? disco.bg : 'rgba(255,255,255,.04)', border: `1px solid ${disco ? disco.border : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Zap style={{ width: 18, height: 18, color: disco ? disco.color : 'rgba(244,247,247,.3)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--gray)' }}>₦{fmtShort(tx.amount)}</span>
                          {disco && <span style={{ fontSize: 9, fontWeight: 700, color: disco.color, background: disco.bg, padding: '2px 7px', borderRadius: 5 }}>{disco.name}</span>}
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(244,247,247,.3)', background: 'rgba(255,255,255,.05)', padding: '2px 6px', borderRadius: 5, textTransform: 'capitalize' }}>{tx.metadata?.meterType}</span>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(244,247,247,.4)', fontFamily: 'var(--mono)', marginTop: 3 }}>{tx.metadata?.meterNumber}</p>
                        <p style={{ fontSize: 10, color: 'rgba(244,247,247,.2)', marginTop: 2 }}>
                          {new Date(tx.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 8px', borderRadius: 6, background: ok ? 'rgba(34,197,94,.1)' : pend ? 'rgba(250,204,21,.1)' : 'rgba(239,68,68,.1)', color: ok ? '#4ade80' : pend ? '#facc15' : '#f87171', border: `1px solid ${ok ? 'rgba(34,197,94,.18)' : pend ? 'rgba(250,204,21,.18)' : 'rgba(239,68,68,.18)'}` }}>
                        {ok ? 'Success' : tx.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
           CONFIRMATION BOTTOM SHEET
      ══════════════════════════════════ */}
      {showSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget && !isPurchasing && !successToken) setShowSheet(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.78)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'scrim .2s ease' }}>
          <div style={{ background: 'var(--primary-mid)', borderRadius: '26px 26px 0 0', maxWidth: 520, width: '100%', margin: '0 auto', animation: 'sheetUp .3s cubic-bezier(.32,.72,0,1)', border: '1px solid var(--mint-border)', borderBottom: 'none', fontFamily: 'var(--font)', color: 'var(--gray)' }}>

            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(83,230,212,.25)' }} />
            </div>

            {successToken ? (
              /* ── SUCCESS — show token ── */
              <div style={{ padding: '16px 22px 36px', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle2 style={{ width: 30, height: 30, color: '#4ade80' }} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray)', marginBottom: 6 }}>Purchase Successful!</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.6 }}>Your electricity token has been generated. Load it on your meter.</p>

                {/* Token display */}
                <div style={{ background: 'var(--carbon)', border: '1px solid rgba(83,230,212,.2)', borderRadius: 16, padding: '18px', marginBottom: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>Your Token</p>
                  <p style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--mint)', letterSpacing: '.08em', marginBottom: 12 }}>{successToken}</p>
                  <button className="copy-btn" onClick={copyToken}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--mint)', cursor: 'pointer', transition: 'background .14s', fontFamily: 'var(--font)' }}>
                    {copied ? <><Check style={{ width: 14, height: 14 }} /> Copied!</> : <><Copy style={{ width: 14, height: 14 }} /> Copy Token</>}
                  </button>
                </div>

                <button onClick={() => { setShowSheet(false); setSuccessToken(''); }}
                  style={{ width: '100%', background: 'var(--mint)', color: 'var(--carbon)', border: 'none', borderRadius: 14, height: 52, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  Done
                </button>
              </div>
            ) : (
              /* ── CONFIRMATION ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 22px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <button className="close-x" onClick={() => setShowSheet(false)}
                    style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .14s' }}>
                    <X style={{ width: 15, height: 15, color: 'var(--muted)' }} />
                  </button>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}>Confirm Purchase</p>
                    <p style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-.025em', fontFamily: 'var(--mono)', color: 'var(--mint)' }}>
                      ₦{fmtShort(numAmount)}<span style={{ fontSize: 18, color: 'rgba(83,230,212,.4)' }}>.00</span>
                    </p>
                  </div>
                  <div style={{ width: 34 }} />
                </div>

                <div style={{ padding: '2px 22px' }}>
                  {[
                    { label: 'DISCO',        val: <span style={{ fontWeight: 700, color: selDisco?.color ?? 'var(--gray)' }}>{selDisco?.fullName}</span> },
                    { label: 'Meter Type',   val: <span style={{ fontWeight: 700, color: 'var(--gray)', textTransform: 'capitalize' }}>{meterType}</span> },
                    { label: 'Meter Number', val: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13 }}>{meterNumber}</span> },
                    { label: 'Customer',     val: <span style={{ fontWeight: 700, color: '#4ade80' }}>{customerName}</span> },
                    { label: 'Phone',        val: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13 }}>{phone}</span> },
                    { label: 'Amount',       val: <span style={{ fontWeight: 800, fontFamily: 'var(--mono)' }}>₦{fmtShort(numAmount)}</span> },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{row.label}</span>
                      <span style={{ fontSize: 14 }}>{row.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray)' }}>Total</span>
                    <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--mint)' }}>₦{fmtShort(numAmount)}</span>
                  </div>
                </div>

                {/* Wallet source */}
                <div style={{ margin: '0 22px 16px', background: 'var(--carbon)', borderRadius: 16, padding: '14px 16px', border: '1px solid var(--mint-border)' }}>
                  <p style={{ fontSize: 10, color: 'rgba(83,230,212,.5)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Paying from</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet style={{ width: 16, height: 16, color: 'var(--mint)' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>DashSub Wallet</p>
                        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Balance: ₦{fmt(wallet?.balance ?? 0)}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--gray)' }}>−₦{fmtShort(numAmount)}</p>
                      <p style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: wallet && wallet.balance >= numAmount ? '#4ade80' : '#f87171' }}>
                        {wallet && wallet.balance >= numAmount ? '✓ Sufficient' : '✗ Insufficient'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 22px 36px' }}>
                  <button className="confirm-btn" onClick={handlePurchase} disabled={isPurchasing}
                    style={{ width: '100%', background: 'var(--mint)', color: 'var(--carbon)', border: 'none', borderRadius: 14, height: 54, fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 6px 24px var(--mint-glow)', opacity: isPurchasing ? .75 : 1 }}>
                    {isPurchasing
                      ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(8,12,12,.3)', borderTopColor: 'var(--carbon)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Processing…</>
                      : <><Zap style={{ width: 17, height: 17 }} /> Confirm & Buy Electricity</>
                    }
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                    <ShieldCheck style={{ width: 11, height: 11, color: 'rgba(83,230,212,.3)' }} />
                    <span style={{ fontSize: 10, color: 'rgba(244,247,247,.25)' }}>Secured · Token delivered instantly</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}