'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone, ArrowLeft, Loader2, CheckCircle2,
  Zap, Clock, X, User, Wallet,
  ShieldCheck, ChevronRight, ArrowRight,
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
  network?: string;
}

/* ── Network map — every possible prefix ── */
const MTN_PREFIXES     = ['0703','0706','0803','0806','0810','0813','0814','0816','0903','0906','0913','0916'];
const GLO_PREFIXES     = ['0705','0805','0807','0811','0815','0905','0915'];
const AIRTEL_PREFIXES  = ['0701','0708','0802','0808','0812','0901','0902','0904','0907','0912'];
const MOBILE9_PREFIXES = ['0809','0817','0818','0908','0909'];

const NETWORKS = [
  { id: 'mtn',     name: 'MTN',     color: '#FACC15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.28)', icon: '/icons/mtn-logo.png'     },
  { id: 'glo',     name: 'Glo',     color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.28)',  icon: '/icons/glo-logo.png'     },
  { id: 'airtel',  name: 'Airtel',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)',  icon: '/icons/airtel-logo.png'  },
  { id: '9mobile', name: '9mobile', color: '#53E6D4', bg: 'rgba(83,230,212,0.12)',  border: 'rgba(83,230,212,0.28)', icon: '/icons/9mobile-logo.png' },
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

const fmt      = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
const fmtShort = (n: number) => n.toLocaleString('en-NG');

/* ── Instant detection — works from first digit ── */
function detectNetwork(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  for (let len = 4; len >= 2; len--) {
    const prefix = d.slice(0, len);
    if (len === 4) {
      if (MTN_PREFIXES.includes(prefix))     return 'mtn';
      if (GLO_PREFIXES.includes(prefix))     return 'glo';
      if (AIRTEL_PREFIXES.includes(prefix))  return 'airtel';
      if (MOBILE9_PREFIXES.includes(prefix)) return '9mobile';
    }
    const mtnM    = MTN_PREFIXES.some(p     => p.startsWith(prefix));
    const gloM    = GLO_PREFIXES.some(p     => p.startsWith(prefix));
    const airtelM = AIRTEL_PREFIXES.some(p  => p.startsWith(prefix));
    const mob9M   = MOBILE9_PREFIXES.some(p => p.startsWith(prefix));
    const count   = [mtnM, gloM, airtelM, mob9M].filter(Boolean).length;
    if (count === 1) {
      if (mtnM)    return 'mtn';
      if (gloM)    return 'glo';
      if (airtelM) return 'airtel';
      if (mob9M)   return '9mobile';
    }
  }
  return null;
}

export default function BuyAirtime() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet]                       = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions]           = useState<Transaction[]>([]);
  const [phoneNumber, setPhoneNumber]             = useState('');
  const [amount, setAmount]                       = useState('');
  const [selectedNetwork, setSelectedNetwork]     = useState<string | null>(null);
  const [detectedNetwork, setDetectedNetwork]     = useState<string | null>(null);
  const [manualOverride, setManualOverride]       = useState(false);
  const [loading, setLoading]                     = useState(true);
  const [isPurchasing, setIsPurchasing]           = useState(false);
  const [showSheet, setShowSheet]                 = useState(false);

  const numAmount = Number(amount) || 0;
  const selNet    = NETWORKS.find(n => n.id === selectedNetwork);
  const canPay    = phoneNumber.replace(/\D/g,'').length === 11 && numAmount >= 50 && !!selectedNetwork;

  const loadData = async () => {
    if (!session?.user?.id) return;
    const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', session.user.id).single();
    if (w) setWallet(w);
    const { data: t } = await supabase.from('transactions').select('*')
      .eq('user_id', session.user.id).eq('type', 'airtime')
      .order('created_at', { ascending: false }).limit(5);
    if (t) setTransactions(t);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    loadData();
    const ch = supabase.channel('wallet_airtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${session.user.id}` },
        (p) => { if (p.new && 'balance' in p.new) setWallet({ balance: p.new.balance as number }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, sessionLoading, router]);

  /* ── Instant detection on every keystroke ── */
  useEffect(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length === 0) {
      setDetectedNetwork(null);
      if (!manualOverride) setSelectedNetwork(null);
      return;
    }
    const found = detectNetwork(digits);
    setDetectedNetwork(found);
    if (found && !manualOverride) setSelectedNetwork(found);
  }, [phoneNumber]);

  useEffect(() => {
    document.body.style.overflow = showSheet ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSheet]);

  const handleNetworkClick = (id: string) => {
    setSelectedNetwork(id);
    setManualOverride(true);
  };

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    setPhoneNumber(digits);
    if (digits.length === 0) setManualOverride(false);
  };

  const handlePayClick = () => {
    if (phoneNumber.replace(/\D/g,'').length < 11) return toast.error('Enter a valid 11-digit number');
    if (numAmount < 50)                            return toast.error('Minimum airtime is ₦50');
    if (!selectedNetwork)                          return toast.error('Select a network');
    if (!wallet || wallet.balance < numAmount)     return toast.error(`Insufficient balance. Need ₦${fmtShort(numAmount)}`);
    setShowSheet(true);
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const res  = await fetch('/api/purchase-airtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session!.user.id, phoneNumber, amount: numAmount, network: selectedNetwork, reference: `AIRTIME_${Date.now()}` }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`₦${fmtShort(numAmount)} airtime sent! 🎉`);
        setPhoneNumber(''); setAmount(''); setSelectedNetwork(null);
        setDetectedNetwork(null); setManualOverride(false); setShowSheet(false);
        loadData();
      } else {
        toast.error(data.message || 'Purchase failed. Try again.');
      }
    } catch {
      toast.error('Something went wrong. Contact support.');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (sessionLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#0D2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 38, height: 38, border: '3px solid rgba(83,230,212,0.2)', borderTopColor: '#53E6D4', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(83,230,212,0.45)', fontSize: 12, fontFamily: 'Sora,sans-serif', fontWeight: 600 }}>Loading…</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Fintech Elite palette — exact match to dashboard ── */
        :root {
          --primary:      #0D2E2E;   /* deep midnight teal — page bg         */
          --primary-mid:  #122f2f;   /* slightly lighter — card/section bg   */
          --carbon:       #080C0C;   /* deepest forest black — dark cards    */
          --mint:         #53E6D4;   /* neon mint — all accents & actions    */
          --gray:         #F4F7F7;   /* soft off-white — primary text        */

          --mint-dim:     rgba(83,230,212,0.12);
          --mint-border:  rgba(83,230,212,0.22);
          --mint-glow:    rgba(83,230,212,0.30);
          --white-5:      rgba(255,255,255,0.05);
          --white-8:      rgba(255,255,255,0.08);
          --muted:        rgba(244,247,247,0.40);
          --border:       rgba(255,255,255,0.07);

          --font: 'Sora', sans-serif;
          --mono: 'IBM Plex Mono', monospace;
        }

        body { background: var(--primary); font-family: var(--font); -webkit-font-smoothing: antialiased; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes sheetUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes scrim   { from { opacity:0; } to { opacity:1; } }
        @keyframes blink   { 0%,100%{opacity:1;} 50%{opacity:.4;} }
        @keyframes popIn   { from{transform:scale(.7);opacity:0;} to{transform:scale(1);opacity:1;} }

        .a1{animation:fadeUp .32s ease .04s both;}
        .a2{animation:fadeUp .32s ease .09s both;}
        .a3{animation:fadeUp .32s ease .14s both;}
        .a4{animation:fadeUp .32s ease .19s both;}
        .a5{animation:fadeUp .32s ease .24s both;}
        .a6{animation:fadeUp .32s ease .29s both;}

        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        input[type=number] { -moz-appearance:textfield; }

        /* phone input glow */
        .phone-wrap:focus-within {
          border-color: var(--mint-border) !important;
          box-shadow: 0 0 0 3px rgba(83,230,212,.07) !important;
        }
        .amt-box:focus-within { border-color: var(--mint-border) !important; }

        /* network buttons */
        .net-btn { transition: all .15s ease; cursor: pointer; border: none; outline: none; }
        .net-btn:hover  { transform: translateY(-2px); }
        .net-btn:active { transform: scale(.93); }

        /* quick chips */
        .chip { transition: all .13s ease; cursor: pointer; border: none; outline: none; }
        .chip:hover  { border-color: var(--mint-border) !important; background: var(--mint-dim) !important; color: var(--mint) !important; }
        .chip:active { transform: scale(.93); }

        /* pay CTA */
        .pay-btn { transition: all .18s ease; cursor: pointer; border: none; outline: none; }
        .pay-btn:hover:not(:disabled)  { transform: translateY(-2px); box-shadow: 0 16px 40px var(--mint-glow) !important; }
        .pay-btn:active:not(:disabled) { transform: scale(.97); }

        /* confirm btn */
        .confirm-btn { transition: all .15s ease; cursor: pointer; border: none; outline: none; }
        .confirm-btn:hover:not(:disabled)  { filter: brightness(1.07); transform: translateY(-1px); }
        .confirm-btn:active:not(:disabled) { transform: scale(.97); }

        /* tx rows */
        .tx-row { transition: background .13s; }
        .tx-row:hover { background: rgba(83,230,212,.03) !important; }

        /* back link */
        .back-link { transition: color .14s; }
        .back-link:hover { color: var(--gray) !important; }
        .back-link:hover .arrow { transform: translateX(-3px); }
        .arrow { transition: transform .14s; }

        /* sheet close */
        .close-x:hover { background: rgba(255,255,255,.12) !important; }

        /* badge pop */
        .badge-enter { animation: popIn .18s cubic-bezier(.34,1.56,.64,1) both; }
        .status-enter { animation: fadeUp .15s ease both; }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)' }}>

        {/* ─── NAV — matches dashboard header style ─── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,230,212,.08)' }}>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/dashboard" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft className="arrow" style={{ width: 16, height: 16 }} />
              Back
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint)', boxShadow: '0 0 8px var(--mint-glow)', display: 'inline-block', animation: 'blink 2.5s ease infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--gray)' }}>Buy Airtime</span>
            </div>
            <Link href="/dashboard/transactions" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mint)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <Clock style={{ width: 13, height: 13 }} />
              History
            </Link>
          </div>
        </nav>

        <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px 110px' }}>

          {/* ── WALLET STRIP — same teal-border style as dashboard virtual account card ── */}
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
            <Link href="/dashboard/fund"
              style={{ fontSize: 12, fontWeight: 800, color: 'var(--carbon)', textDecoration: 'none', background: 'var(--mint)', padding: '8px 16px', borderRadius: 10, boxShadow: '0 4px 14px var(--mint-glow)' }}>
              + Fund
            </Link>
          </div>

          {/* ── PHONE INPUT ── */}
          <div className="a2" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Phone Number
            </label>
            <div className="phone-wrap" style={{ background: 'var(--carbon)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', overflow: 'hidden', transition: 'border-color .2s, box-shadow .2s' }}>

              {/* Live network badge */}
              <div style={{ minWidth: 92, padding: '0 12px', height: 56, display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid var(--border)', background: selNet ? selNet.bg : 'transparent', flexShrink: 0, transition: 'background .2s' }}>
                {selNet ? (
                  <div key={selNet.id} className="badge-enter" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={selNet.icon} alt={selNet.name} style={{ width: 22, height: 22, objectFit: 'contain' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: selNet.color }}>{selNet.name}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(244,247,247,.2)', fontWeight: 500 }}>Auto</span>
                )}
              </div>

              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="0801 234 5678"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray)', fontSize: 16, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '.05em', padding: '0 14px', height: 56 }}
              />

              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: phoneNumber.length === 11 ? 'var(--mint)' : 'rgba(244,247,247,.18)', marginRight: 10, flexShrink: 0, transition: 'color .2s' }}>
                {phoneNumber.length}/11
              </span>

              <button title="Contacts" style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                <User style={{ width: 15, height: 15, color: 'rgba(244,247,247,.35)' }} />
              </button>
            </div>

            {/* Detection status */}
            {phoneNumber.length > 0 && (
              <div className="status-enter" style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                {detectedNetwork ? (
                  <>
                    <CheckCircle2 style={{ width: 12, height: 12, color: 'var(--mint)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--mint)', fontWeight: 700 }}>
                      {NETWORKS.find(n => n.id === detectedNetwork)?.name} number detected
                      {manualOverride && detectedNetwork !== selectedNetwork && (
                        <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · overridden</span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FACC15', display: 'inline-block', flexShrink: 0, animation: 'blink 1s ease infinite' }} />
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Detecting network…</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── NETWORK SELECTOR ── */}
          <div className="a3" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Network <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(244,247,247,.18)', fontSize: 10 }}>— tap to change</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {NETWORKS.map((net) => {
                const active     = selectedNetwork === net.id;
                const isDetected = detectedNetwork === net.id && !active;
                return (
                  <button key={net.id} className="net-btn" onClick={() => handleNetworkClick(net.id)}
                    style={{ background: active ? net.bg : 'var(--carbon)', border: `1.5px solid ${active ? net.border : isDetected ? net.border + '66' : 'var(--border)'}`, borderRadius: 14, padding: '12px 6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}
                  >
                    <img src={net.icon} alt={net.name} style={{ width: 30, height: 30, objectFit: 'contain' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: active ? net.color : 'rgba(244,247,247,.35)' }}>{net.name}</span>
                    {active && (
                      <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: net.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${net.color}55`, animation: 'popIn .18s ease' }}>
                        <CheckCircle2 style={{ width: 11, height: 11, color: 'white' }} />
                      </span>
                    )}
                    {isDetected && (
                      <span style={{ position: 'absolute', inset: -2, borderRadius: 15, border: `1.5px solid ${net.color}44`, pointerEvents: 'none' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── AMOUNT CARD — carbon like wallet/tx cards on dashboard ── */}
          <div className="a4" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '18px', marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
              Amount
            </label>

            {/* Quick chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {QUICK_AMOUNTS.map((q) => {
                const active = amount === q.toString();
                return (
                  <button key={q} className="chip"
                    onClick={() => setAmount(q.toString())}
                    style={{ background: active ? 'var(--mint-dim)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'var(--mint-border)' : 'var(--border)'}`, borderRadius: 11, padding: '10px 0', color: active ? 'var(--mint)' : 'rgba(244,247,247,.5)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)' }}
                  >
                    ₦{fmtShort(q)}
                  </button>
                );
              })}
            </div>

            {/* Custom amount */}
            <div className="amt-box" style={{ background: 'rgba(0,0,0,.3)', border: '1px solid var(--border)', borderRadius: 13, display: 'flex', alignItems: 'center', padding: '0 14px', transition: 'border-color .2s' }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(244,247,247,.2)', marginRight: 4 }}>₦</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount"
                min="50"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', padding: '14px 0' }}
              />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(244,247,247,.2)', marginTop: 7 }}>Min ₦50 · Max ₦500,000</p>
          </div>

          {/* ── PAY BUTTON — same mint CTA as dashboard Fund Wallet ── */}
          <div className="a5">
            <button className="pay-btn" onClick={handlePayClick} disabled={!canPay}
              style={{ width: '100%', background: canPay ? 'var(--mint)' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 14, height: 54, color: canPay ? 'var(--carbon)' : 'rgba(244,247,247,.2)', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: canPay ? '0 6px 24px var(--mint-glow)' : 'none', letterSpacing: '-.01em' }}
            >
              {canPay
                ? <><Zap style={{ width: 16, height: 16 }} /> Continue — ₦{fmtShort(numAmount)} <ChevronRight style={{ width: 14, height: 14 }} /></>
                : <><Phone style={{ width: 15, height: 15 }} /> Fill in your details</>
              }
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 9 }}>
              <ShieldCheck style={{ width: 11, height: 11, color: 'rgba(244,247,247,.18)' }} />
              <span style={{ fontSize: 10, color: 'rgba(244,247,247,.18)', fontWeight: 500 }}>256-bit encrypted · Instant delivery</span>
            </div>
          </div>

          {/* ── RECENT TRANSACTIONS — carbon card like dashboard ── */}
          <div className="a6" style={{ marginTop: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Recent Purchases</span>
              <Link href="/dashboard/history" style={{ fontSize: 12, color: 'var(--mint)', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                See all <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>

            <div style={{ background: 'var(--carbon)', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.05)' }}>
              {transactions.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <Phone style={{ width: 19, height: 19, color: 'rgba(244,247,247,.16)' }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,.28)', fontWeight: 500 }}>No purchases yet</p>
                  <p style={{ fontSize: 11, color: 'rgba(244,247,247,.16)', marginTop: 4 }}>Your transactions will appear here</p>
                </div>
              ) : (
                transactions.map((tx) => {
                  const txNet = NETWORKS.find(n => n.id === tx.network);
                  const ok    = tx.status === 'completed' || tx.status === 'success';
                  const pend  = tx.status === 'pending';
                  return (
                    <div key={tx.id} className="tx-row" style={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,.04)', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: txNet ? txNet.bg : 'rgba(255,255,255,.04)', border: `1px solid ${txNet ? txNet.border : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {txNet
                          ? <img src={txNet.icon} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                          : <Phone style={{ width: 16, height: 16, color: 'rgba(244,247,247,.3)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--gray)' }}>₦{fmtShort(tx.amount)}</span>
                          {txNet && <span style={{ fontSize: 9, fontWeight: 700, color: txNet.color, background: txNet.bg, padding: '2px 7px', borderRadius: 5 }}>{txNet.name}</span>}
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(244,247,247,.4)', fontFamily: 'var(--mono)', marginTop: 3 }}>{tx.phone_number}</p>
                        <p style={{ fontSize: 10, color: 'rgba(244,247,247,.2)', marginTop: 2 }}>
                          {new Date(tx.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 8px', borderRadius: 6, background: ok ? 'rgba(34,197,94,.1)' : pend ? 'rgba(250,204,21,.1)' : 'rgba(239,68,68,.1)', color: ok ? '#4ade80' : pend ? '#facc15' : '#f87171', border: `1px solid ${ok ? 'rgba(34,197,94,.18)' : pend ? 'rgba(250,204,21,.18)' : 'rgba(239,68,68,.18)'}` }}>
                        {tx.status}
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
           BOTTOM SHEET — dark teal themed
      ══════════════════════════════════ */}
      {showSheet && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowSheet(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.78)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'scrim .2s ease' }}
        >
          <div style={{ background: 'var(--primary-mid)', borderRadius: '26px 26px 0 0', maxWidth: 520, width: '100%', margin: '0 auto', animation: 'sheetUp .3s cubic-bezier(.32,.72,0,1)', border: '1px solid var(--mint-border)', borderBottom: 'none', fontFamily: 'var(--font)', color: 'var(--gray)' }}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(83,230,212,.25)' }} />
            </div>

            {/* Header */}
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

            {/* Detail rows */}
            <div style={{ padding: '2px 22px' }}>
              {[
                {
                  label: 'Network',
                  val: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {selNet && <img src={selNet.icon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />}
                      <span style={{ fontWeight: 700, color: selNet?.color ?? 'var(--gray)' }}>{selNet?.name} Airtime</span>
                    </div>
                  ),
                },
                {
                  label: 'Recipient',
                  val: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, letterSpacing: '.04em', color: 'var(--gray)' }}>
                    {phoneNumber.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3')}
                  </span>,
                },
                {
                  label: 'Amount',
                  val: <span style={{ fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--gray)' }}>₦{fmtShort(numAmount)}</span>,
                },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 14 }}>{row.val}</span>
                </div>
              ))}

              {/* Total */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray)' }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--mint)' }}>₦{fmtShort(numAmount)}</span>
              </div>
            </div>

            {/* Wallet source — carbon card inside sheet */}
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

            {/* Confirm CTA — same mint button as dashboard */}
            <div style={{ padding: '0 22px 36px' }}>
              <button className="confirm-btn" onClick={handlePurchase} disabled={isPurchasing}
                style={{ width: '100%', background: 'var(--mint)', color: 'var(--carbon)', border: 'none', borderRadius: 14, height: 54, fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 6px 24px var(--mint-glow)', opacity: isPurchasing ? .75 : 1, letterSpacing: '-.01em' }}
              >
                {isPurchasing
                  ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Processing…</>
                  : <><Zap style={{ width: 17, height: 17 }} /> Confirm & Send Airtime</>
                }
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                <ShieldCheck style={{ width: 11, height: 11, color: 'rgba(83,230,212,.3)' }} />
                <span style={{ fontSize: 10, color: 'rgba(244,247,247,.25)' }}>Secured · Passcode lock coming soon</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}