'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wifi, ArrowLeft, Wallet, Loader2, CheckCircle2,
  Zap, Clock, ChevronRight, ArrowRight, User,
  Flame, Sun, CalendarDays, Calendar, X, ShieldCheck,
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
  plan_code?: string;
}

interface DataPlan {
  plan_code: string;
  plan_name: string;
  plan_amount: number;
  plan_duration: string;
  plan_type?: string;
}

const NETWORKS = [
  { id: '1', name: 'MTN',     color: '#FACC15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.28)', icon: '/icons/mtn-logo.png'     },
  { id: '2', name: 'Glo',     color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.28)',  icon: '/icons/glo-logo.png'     },
  { id: '3', name: 'Airtel',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)',  icon: '/icons/airtel-logo.png'  },
  { id: '4', name: '9mobile', color: '#53E6D4', bg: 'rgba(83,230,212,0.12)',  border: 'rgba(83,230,212,0.28)', icon: '/icons/9mobile-logo.png' },
];

type TabId = 'hot' | 'daily' | 'weekly' | 'monthly';

const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: 'hot',     label: 'Hot',     Icon: Flame        },
  { id: 'daily',   label: 'Daily',   Icon: Sun          },
  { id: 'weekly',  label: 'Weekly',  Icon: CalendarDays },
  { id: 'monthly', label: 'Monthly', Icon: Calendar     },
];

const fmt      = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
const fmtShort = (n: number) => n.toLocaleString('en-NG');

// ── Fixed parsePlan — handles names like "1GB", "1.5GB", "500MB", "1GB - SME2" ──
function parsePlan(name: string) {
  // Strip plan type suffix e.g. " - SME2", " - GIFTING"
  const clean = name
    .replace(/\s*-\s*(SME2?|GIFTING|CORPORATE GIFTING|DATA SHARE|SPECIAL|TALKMORE|MTN AWOOF)/gi, '')
    .trim();

  const size = clean.match(/(\d+(?:\.\d+)?)\s*(MB|GB|TB)/i);
  const dur  = clean.match(/(\d+)\s*(days?)/i);

  return {
    size:     size ? `${size[1]}${size[2].toUpperCase()}` : clean,
    duration: dur  ? `${dur[1]} ${Number(dur[1]) === 1 ? 'Day' : 'Days'}` : '',
    badge:    name.includes('SME2')    ? 'SME2'
            : name.includes('SME')     ? 'SME'
            : name.includes('AWOOF') || name.includes('Awoof') ? 'Awoof'
            : name.includes('Night')   ? 'Night'
            : name.includes('Weekend') ? 'Weekend'
            : name.includes('Social')  ? 'Social'
            : name.includes('SHARE')   ? 'Share'
            : '',
  };
}

// ── Categorize plans by duration ──
function categorizePlans(plans: DataPlan[]) {
  const hot: DataPlan[] = [], daily: DataPlan[] = [], weekly: DataPlan[] = [], monthly: DataPlan[] = [];
  plans.forEach((p) => {
    const d    = (p.plan_duration ?? '').toLowerCase();
    const days = parseInt(d) || 0;

    if (days === 0) {
      // No numeric duration (e.g. "Social", "Night", "Weekend") — put in daily
      daily.push(p);
    } else if (days <= 3) {
      daily.push(p);
      if (p.plan_amount <= 600) hot.push(p);
    } else if (days <= 14) {
      weekly.push(p);
    } else {
      monthly.push(p);
    }
  });
  return { hot, daily, weekly, monthly };
}

export default function BuyData() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet]                   = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions]       = useState<Transaction[]>([]);
  const [phoneNumber, setPhoneNumber]         = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan]       = useState<DataPlan | null>(null);
  const [dataPlans, setDataPlans]             = useState<DataPlan[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [loadingPlans, setLoadingPlans]       = useState(false);
  const [isPurchasing, setIsPurchasing]       = useState(false);
  const [activeTab, setActiveTab]             = useState<TabId>('hot');
  const [showSheet, setShowSheet]             = useState(false);

  // Ref so realtime callback always has latest selectedNetwork
  const selectedNetworkRef = useRef<string | null>(null);
  useEffect(() => { selectedNetworkRef.current = selectedNetwork; }, [selectedNetwork]);

  const selNet       = NETWORKS.find(n => n.id === selectedNetwork);
  const categorized  = useMemo(() => categorizePlans(dataPlans), [dataPlans]);
  const displayPlans = categorized[activeTab];
  const canPay       = phoneNumber.length === 11 && !!selectedPlan;

  // ── Load wallet + recent transactions ──
  const loadData = async () => {
    if (!session?.user?.id) return;
    const { data: w } = await supabase
      .from('wallets').select('balance').eq('user_id', session.user.id).single();
    if (w) setWallet(w);

    const { data: t } = await supabase
      .from('transactions').select('*')
      .eq('user_id', session.user.id).eq('type', 'data')
      .order('created_at', { ascending: false }).limit(5);
    if (t) setTransactions(t);
    setLoading(false);
  };

  // ── Load data plans from API (reads selling_price from Supabase) ──
  const loadDataPlans = async (networkId: string) => {
    setLoadingPlans(true);
    setDataPlans([]);
    setSelectedPlan(null);
    try {
      const res = await fetch(`/api/get-data-plans?network=${networkId}`);
      if (!res.ok) throw new Error('Bad response');
      const plans = await res.json();
      setDataPlans(Array.isArray(plans) ? plans : []);
      if (!plans.length) toast.info('No plans available for this network');
    } catch {
      toast.error('Could not load data plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  // ── Auth + Realtime subscriptions ──
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    loadData();

    // 1. Wallet balance updates
    const walletCh = supabase
      .channel('wallet_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${session.user.id}`,
      }, (p) => {
        if (p.new?.balance !== undefined) {
          setWallet({ balance: p.new.balance as number });
        }
      })
      .subscribe();

    // 2. data_plans price/active changes → reload plans if network selected
    const plansCh = supabase
      .channel('data_plans_realtime')
      .on('postgres_changes', {
        event: '*',          // UPDATE, INSERT, DELETE
        schema: 'public',
        table: 'data_plans',
      }, () => {
        const net = selectedNetworkRef.current;
        if (net) loadDataPlans(net);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(walletCh);
      supabase.removeChannel(plansCh);
    };
  }, [session, sessionLoading, router]);

  // ── Reload plans when network changes ──
  useEffect(() => {
    if (selectedNetwork) loadDataPlans(selectedNetwork);
  }, [selectedNetwork]);

  // ── Lock body scroll when sheet is open ──
  useEffect(() => {
    document.body.style.overflow = showSheet ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSheet]);

  const handlePlanClick = (plan: DataPlan) => setSelectedPlan(plan);

  const handleContinue = () => {
    if (phoneNumber.length < 11) return toast.error('Enter a valid 11-digit number');
    if (!selectedPlan)           return toast.error('Select a data plan');
    if (!wallet || wallet.balance < selectedPlan.plan_amount)
      return toast.error(`Insufficient balance. Need ₦${fmtShort(selectedPlan.plan_amount)}`);
    setShowSheet(true);
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;
    setIsPurchasing(true);
    try {
      const res = await fetch('/api/purchase-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:      session!.user.id,
          phoneNumber,
          network:     selectedNetwork,
          networkCode: selNet?.id || selectedNetwork,
          planCode:    selectedPlan.plan_code,
          reference:   `DATA_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${selectedPlan.plan_name} delivered! 🎉`);
        setPhoneNumber('');
        setSelectedNetwork(null);
        setSelectedPlan(null);
        setDataPlans([]);
        setShowSheet(false);
        loadData();
      } else {
        toast.error(data.message || 'Purchase failed');
      }
    } catch {
      toast.error('Something went wrong');
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
        :root {
          --primary:      #0D2E2E;
          --primary-mid:  #122f2f;
          --carbon:       #080C0C;
          --mint:         #53E6D4;
          --gray:         #F4F7F7;
          --mint-dim:     rgba(83,230,212,0.12);
          --mint-border:  rgba(83,230,212,0.22);
          --mint-glow:    rgba(83,230,212,0.30);
          --muted:        rgba(244,247,247,0.40);
          --border:       rgba(255,255,255,0.07);
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
        .a1{animation:fadeUp .32s ease .04s both;}
        .a2{animation:fadeUp .32s ease .09s both;}
        .a3{animation:fadeUp .32s ease .14s both;}
        .a4{animation:fadeUp .32s ease .19s both;}
        .a5{animation:fadeUp .32s ease .24s both;}
        .a6{animation:fadeUp .32s ease .29s both;}
        input::-webkit-inner-spin-button, input::-webkit-outer-spin-button { -webkit-appearance:none; }
        .phone-wrap:focus-within { border-color: var(--mint-border) !important; box-shadow: 0 0 0 3px rgba(83,230,212,.07) !important; }
        .net-btn   { transition: all .15s ease; cursor: pointer; border: none; outline: none; }
        .net-btn:hover  { transform: translateY(-2px); }
        .net-btn:active { transform: scale(.93); }
        .tab-btn   { transition: all .14s ease; cursor: pointer; border: none; outline: none; }
        .tab-btn:hover:not(.tab-active) { background: rgba(83,230,212,.07) !important; color: var(--mint) !important; }
        .plan-card { transition: all .15s ease; cursor: pointer; border: none; outline: none; text-align: left; width: 100%; }
        .plan-card:hover:not(.plan-active) { border-color: rgba(83,230,212,.3) !important; background: rgba(83,230,212,.05) !important; }
        .plan-card:active { transform: scale(.98); }
        .pay-btn   { transition: all .18s ease; cursor: pointer; border: none; outline: none; }
        .pay-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 40px var(--mint-glow) !important; }
        .pay-btn:active:not(:disabled) { transform: scale(.97); }
        .confirm-btn { transition: all .15s ease; cursor: pointer; border: none; outline: none; }
        .confirm-btn:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
        .confirm-btn:active:not(:disabled) { transform: scale(.97); }
        .tx-row { transition: background .13s; }
        .tx-row:hover { background: rgba(83,230,212,.03) !important; }
        .plan-scroll::-webkit-scrollbar { width: 3px; }
        .plan-scroll::-webkit-scrollbar-thumb { background: rgba(83,230,212,.2); border-radius: 4px; }
        .back-link { transition: color .14s; }
        .back-link:hover { color: var(--gray) !important; }
        .back-link:hover .arrow { transform: translateX(-3px); }
        .arrow { transition: transform .14s; }
        .badge-enter { animation: popIn .18s cubic-bezier(.34,1.56,.64,1) both; }
        .close-x:hover { background: rgba(255,255,255,.12) !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)' }}>

        {/* NAV */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,230,212,.08)' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/dashboard" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft className="arrow" style={{ width: 16, height: 16 }} />Back
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint)', boxShadow: '0 0 8px var(--mint-glow)', display: 'inline-block', animation: 'blink 2.5s ease infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--gray)' }}>Buy Data</span>
            </div>
            <Link href="/dashboard/transactions" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mint)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <Clock style={{ width: 13, height: 13 }} />History
            </Link>
          </div>
        </nav>

        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 110px' }}>

          {/* WALLET */}
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

          {/* PHONE INPUT */}
          <div className="a2" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Phone Number
            </label>
            <div className="phone-wrap" style={{ background: 'var(--carbon)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', overflow: 'hidden', transition: 'border-color .2s, box-shadow .2s' }}>
              <div style={{ minWidth: 92, padding: '0 12px', height: 56, display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid var(--border)', background: selNet ? selNet.bg : 'transparent', flexShrink: 0, transition: 'background .2s' }}>
                {selNet ? (
                  <div key={selNet.id} className="badge-enter" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={selNet.icon} alt={selNet.name} style={{ width: 22, height: 22, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: selNet.color }}>{selNet.name}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(244,247,247,.2)', fontWeight: 500 }}>Network</span>
                )}
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
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
          </div>

          {/* NETWORK SELECTOR */}
          <div className="a3" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Network
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {NETWORKS.map((net) => {
                const active = selectedNetwork === net.id;
                return (
                  <button key={net.id} className="net-btn"
                    onClick={() => { setSelectedNetwork(net.id); setSelectedPlan(null); setActiveTab('hot'); }}
                    style={{ background: active ? net.bg : 'var(--carbon)', border: `1.5px solid ${active ? net.border : 'var(--border)'}`, borderRadius: 14, padding: '12px 6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                    <img src={net.icon} alt={net.name} style={{ width: 30, height: 30, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: active ? net.color : 'rgba(244,247,247,.35)' }}>{net.name}</span>
                    {active && (
                      <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: net.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${net.color}55`, animation: 'popIn .18s ease' }}>
                        <CheckCircle2 style={{ width: 11, height: 11, color: 'white' }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DATA PLANS */}
          {selectedNetwork && (
            <div className="a4" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '18px', marginBottom: 18 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
                Data Plans
              </p>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.05)', overflowX: 'auto' }}>
                {TABS.map(({ id, label, Icon }) => {
                  const count  = categorized[id].length;
                  const active = activeTab === id;
                  return (
                    <button key={id} className={`tab-btn${active ? ' tab-active' : ''}`}
                      onClick={() => { setActiveTab(id); setSelectedPlan(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: active ? 'var(--mint)' : 'rgba(255,255,255,.04)', color: active ? 'var(--carbon)' : 'var(--muted)', border: `1px solid ${active ? 'transparent' : 'var(--border)'}` }}>
                      <Icon style={{ width: 13, height: 13 }} />
                      {label}
                      <span style={{ fontSize: 10, fontWeight: 800, background: active ? 'rgba(8,12,12,.2)' : 'rgba(255,255,255,.06)', padding: '1px 6px', borderRadius: 10 }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Plan cards */}
              {loadingPlans ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid rgba(83,230,212,.2)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin .8s linear infinite', marginBottom: 10 }} />
                  <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Loading plans…</p>
                </div>
              ) : displayPlans.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,.28)', fontWeight: 500 }}>No plans in this category</p>
                </div>
              ) : (
                <div className="plan-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 460, overflowY: 'auto', paddingRight: 2 }}>
                  {displayPlans.map((plan) => {
                    const { size, duration, badge } = parsePlan(plan.plan_name);
                    const active = selectedPlan?.plan_code === plan.plan_code;
                    return (
                      <button key={plan.plan_code} className={`plan-card${active ? ' plan-active' : ''}`}
                        onClick={() => handlePlanClick(plan)}
                        style={{ background: active ? 'var(--mint-dim)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'var(--mint-border)' : 'var(--border)'}`, borderRadius: 14, padding: '14px 12px', position: 'relative' }}>
                        <p style={{ fontSize: 18, fontWeight: 900, color: active ? 'var(--mint)' : 'var(--gray)', fontFamily: 'var(--mono)', lineHeight: 1, marginBottom: 4 }}>{size || '—'}</p>
                        <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>{duration}</p>
                        {badge && (
                          <span style={{ display: 'inline-block', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--mint-dim)', color: 'var(--mint)', border: '1px solid var(--mint-border)', padding: '2px 6px', borderRadius: 6, marginBottom: 8 }}>{badge}</span>
                        )}
                        <p style={{ fontSize: 14, fontWeight: 800, color: active ? 'var(--mint)' : 'var(--gray)', fontFamily: 'var(--mono)' }}>₦{fmtShort(plan.plan_amount)}</p>
                        {active && (
                          <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px var(--mint-glow)', animation: 'popIn .18s ease' }}>
                            <CheckCircle2 style={{ width: 11, height: 11, color: 'var(--carbon)' }} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SELECTED PLAN SUMMARY */}
          {selectedPlan && (
            <div className="a5" style={{ background: 'var(--primary-mid)', border: '1px solid var(--mint-border)', borderRadius: 16, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(83,230,212,.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Selected Plan</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray)' }}>{parsePlan(selectedPlan.plan_name).size} · {parsePlan(selectedPlan.plan_name).duration}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--mint)', fontFamily: 'var(--mono)' }}>₦{fmtShort(selectedPlan.plan_amount)}</p>
                <button onClick={() => setSelectedPlan(null)} style={{ fontSize: 10, color: 'rgba(244,247,247,.3)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>Change</button>
              </div>
            </div>
          )}

          {/* PAY BUTTON */}
          <div className="a5">
            <button className="pay-btn" onClick={handleContinue} disabled={!canPay}
              style={{ width: '100%', background: canPay ? 'var(--mint)' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 14, height: 54, color: canPay ? 'var(--carbon)' : 'rgba(244,247,247,.2)', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: canPay ? '0 6px 24px var(--mint-glow)' : 'none', letterSpacing: '-.01em' }}>
              {canPay
                ? <><Zap style={{ width: 16, height: 16 }} /> Continue — ₦{fmtShort(selectedPlan!.plan_amount)} <ChevronRight style={{ width: 14, height: 14 }} /></>
                : <><Wifi style={{ width: 15, height: 15 }} /> Select network & plan</>}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 9 }}>
              <ShieldCheck style={{ width: 11, height: 11, color: 'rgba(244,247,247,.18)' }} />
              <span style={{ fontSize: 10, color: 'rgba(244,247,247,.18)', fontWeight: 500 }}>256-bit encrypted · Instant delivery</span>
            </div>
          </div>

          {/* RECENT TRANSACTIONS */}
          <div className="a6" style={{ marginTop: 36 }}>
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
                    <Wifi style={{ width: 19, height: 19, color: 'rgba(244,247,247,.16)' }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,.28)', fontWeight: 500 }}>No purchases yet</p>
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
                          ? <img src={txNet.icon} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <Wifi style={{ width: 16, height: 16, color: 'rgba(244,247,247,.3)' }} />}
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

      {/* CONFIRMATION SHEET */}
      {showSheet && selectedPlan && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowSheet(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.78)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'scrim .2s ease' }}>
          <div style={{ background: 'var(--primary-mid)', borderRadius: '26px 26px 0 0', maxWidth: 560, width: '100%', margin: '0 auto', animation: 'sheetUp .3s cubic-bezier(.32,.72,0,1)', border: '1px solid var(--mint-border)', borderBottom: 'none', fontFamily: 'var(--font)', color: 'var(--gray)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(83,230,212,.25)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 22px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <button className="close-x" onClick={() => setShowSheet(false)}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .14s' }}>
                <X style={{ width: 15, height: 15, color: 'var(--muted)' }} />
              </button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(83,230,212,.5)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}>Confirm Purchase</p>
                <p style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-.025em', fontFamily: 'var(--mono)', color: 'var(--mint)' }}>
                  ₦{fmtShort(selectedPlan.plan_amount)}<span style={{ fontSize: 18, color: 'rgba(83,230,212,.4)' }}>.00</span>
                </p>
              </div>
              <div style={{ width: 34 }} />
            </div>
            <div style={{ padding: '2px 22px' }}>
              {[
                { label: 'Product Name', val: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {selNet && <img src={selNet.icon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    <span style={{ fontWeight: 700, color: selNet?.color ?? 'var(--gray)' }}>Mobile Data</span>
                  </div>
                )},
                { label: 'Recipient Mobile', val: (
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, letterSpacing: '.04em', color: 'var(--gray)' }}>
                    {phoneNumber.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3')}
                  </span>
                )},
                { label: 'Data Bundle', val: (
                  <span style={{ fontWeight: 700, color: 'var(--gray)' }}>
                    {parsePlan(selectedPlan.plan_name).size} · {parsePlan(selectedPlan.plan_name).duration}
                  </span>
                )},
                { label: 'Amount', val: (
                  <span style={{ fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--gray)' }}>₦{fmtShort(selectedPlan.plan_amount)}</span>
                )},
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 14 }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray)' }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--mint)' }}>₦{fmtShort(selectedPlan.plan_amount)}</span>
              </div>
            </div>
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
                  <p style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--gray)' }}>−₦{fmtShort(selectedPlan.plan_amount)}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: wallet && wallet.balance >= selectedPlan.plan_amount ? '#4ade80' : '#f87171' }}>
                    {wallet && wallet.balance >= selectedPlan.plan_amount ? '✓ Sufficient' : '✗ Insufficient'}
                  </p>
                </div>
              </div>
            </div>
            <div style={{ padding: '0 22px 36px' }}>
              <button className="confirm-btn" onClick={handlePurchase} disabled={isPurchasing}
                style={{ width: '100%', background: 'var(--mint)', color: 'var(--carbon)', border: 'none', borderRadius: 14, height: 54, fontSize: 15, fontWeight: 800, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 6px 24px var(--mint-glow)', opacity: isPurchasing ? .75 : 1, letterSpacing: '-.01em' }}>
                {isPurchasing
                  ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Processing…</>
                  : <><Zap style={{ width: 17, height: 17 }} /> Confirm & Buy Data</>}
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