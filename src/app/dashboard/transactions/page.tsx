'use client';

import { useEffect, useState, useMemo, JSX } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Wallet, Loader2, Search, Phone,
  ChevronRight, ArrowUpRight, ArrowDownLeft, Clock,
  CheckCircle2, XCircle, Sparkles, Filter, Copy, Check,
  X, Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending' | 'completed';
  created_at: string;
  reference: string;
  type: 'deposit' | 'airtime' | 'data' | 'withdrawal' | string;
  phone_number?: string;
  network?: string;
  metadata?: any;
}

const PAGE_SIZE = 20;

const fmt = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2 });

/* ── per-type config ── */
const TX_META: Record<string, { label: string; iconBg: string; iconColor: string }> = {
  deposit:    { label: 'Deposit',    iconBg: 'rgba(34,197,94,.12)',   iconColor: '#4ade80'  },
  airtime:    { label: 'Airtime',    iconBg: 'rgba(96,165,250,.12)',  iconColor: '#60a5fa'  },
  data:       { label: 'Data',       iconBg: 'rgba(192,132,252,.12)', iconColor: '#c084fc'  },
  withdrawal: { label: 'Withdrawal', iconBg: 'rgba(251,191,36,.12)',  iconColor: '#fbbf24'  },
};
const DEFAULT_META = { label: 'Transaction', iconBg: 'rgba(83,230,212,.1)', iconColor: '#53E6D4' };

/* ── network colors ── */
const NET_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  mtn:     { color: '#FACC15', bg: 'rgba(250,204,21,.1)',  border: 'rgba(250,204,21,.25)' },
  glo:     { color: '#22C55E', bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.25)'  },
  airtel:  { color: '#EF4444', bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.25)'  },
  '9mobile':{ color: '#53E6D4', bg: 'rgba(83,230,212,.1)', border: 'rgba(83,230,212,.25)' },
};

function TxIcon({ type }: { type: string }) {
  const m = TX_META[type] || DEFAULT_META;
  const Icon = type === 'deposit' ? ArrowDownLeft
    : type === 'withdrawal' ? ArrowUpRight
    : type === 'airtime'    ? Phone
    : type === 'data'       ? Wifi
    : Sparkles;
  return (
    <div style={{ width: 42, height: 42, borderRadius: 13, background: m.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon style={{ width: 18, height: 18, color: m.iconColor }} />
    </div>
  );
}

export default function Transactions() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterType, setFilterType]     = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [wallet, setWallet]             = useState<{ balance: number } | null>(null);
  const [selected, setSelected]         = useState<Transaction | null>(null);
  const [copied, setCopied]             = useState(false);

  /* ── fetch ── */
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    const userId = session.user.id;

    const fetchData = async () => {
      setLoading(true);
      const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', userId).single();
      if (w) setWallet(w);

      const { data, error } = await supabase.from('transactions').select('*')
        .eq('user_id', userId).order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (error) { toast.error('Failed to load transactions'); }
      else {
        setTransactions(prev => page === 1 ? (data || []) : [...prev, ...(data || [])]);
        setHasMore((data?.length || 0) === PAGE_SIZE);
      }
      setLoading(false);
    };

    fetchData();

    const ch = supabase.channel(`user_tx_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        (p) => { setTransactions(prev => [p.new as Transaction, ...prev]); toast.success('New transaction received'); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, sessionLoading, router, page]);

  /* ── scroll lock when sheet open ── */
  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  /* ── filtering ── */
  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const matchFilter = filterType === 'all'
        || (['success','failed','pending'].includes(filterType) ? tx.status === filterType : tx.type === filterType);
      if (!searchQuery.trim()) return matchFilter;
      const q = searchQuery.toLowerCase();
      return matchFilter && [tx.reference, tx.phone_number, tx.network].some(f => f?.toLowerCase().includes(q));
    });
  }, [transactions, filterType, searchQuery]);

  /* ── stats ── */
  const stats = useMemo(() => ({
    total:      transactions.length,
    successful: transactions.filter(t => t.status === 'success' || t.status === 'completed').length,
    pending:    transactions.filter(t => t.status === 'pending').length,
    failed:     transactions.filter(t => t.status === 'failed').length,
  }), [transactions]);

  /* ── group by month ── */
  const grouped = useMemo(() => {
    const groups: { label: string; inflow: number; outflow: number; txs: Transaction[] }[] = [];
    filtered.forEach(tx => {
      const d   = new Date(tx.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      let g = groups.find(x => x.label === key);
      if (!g) { g = { label: key, inflow: 0, outflow: 0, txs: [] }; groups.push(g); }
      if (tx.type === 'deposit')   g.inflow  += tx.amount;
      else                         g.outflow += tx.amount;
      g.txs.push(tx);
    });
    return groups;
  }, [filtered]);

  const copyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (sessionLoading || (loading && page === 1)) return (
    <div style={{ minHeight: '100vh', background: '#0D2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 38, height: 38, border: '3px solid rgba(83,230,212,.2)', borderTopColor: '#53E6D4', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(83,230,212,.45)', fontSize: 12, fontFamily: 'Sora,sans-serif', fontWeight: 600 }}>Loading transactions…</p>
      </div>
    </div>
  );

  const selMeta = selected ? (TX_META[selected.type] || DEFAULT_META) : null;
  const selOk   = selected && (selected.status === 'success' || selected.status === 'completed');
  const selPend = selected && selected.status === 'pending';
  const selNet  = selected?.network ? NET_COLOR[selected.network] : null;

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

        .a1{animation:fadeUp .3s ease .04s both;}
        .a2{animation:fadeUp .3s ease .09s both;}
        .a3{animation:fadeUp .3s ease .14s both;}
        .a4{animation:fadeUp .3s ease .19s both;}

        /* filter chips */
        .chip { transition: all .14s ease; cursor: pointer; border: none; outline: none; white-space: nowrap; flex-shrink: 0; }
        .chip:hover:not(.chip-active) { background: rgba(83,230,212,.08) !important; color: var(--mint) !important; }

        /* tx row */
        .tx-row { transition: background .13s; cursor: pointer; }
        .tx-row:hover { background: rgba(83,230,212,.03) !important; }
        .tx-row:active { background: rgba(83,230,212,.06) !important; }

        /* load more */
        .load-more { transition: all .16s; cursor: pointer; border: none; outline: none; }
        .load-more:hover:not(:disabled) { border-color: var(--mint-border) !important; background: rgba(83,230,212,.05) !important; color: var(--mint) !important; }

        /* search */
        .search-input:focus { border-color: var(--mint-border) !important; box-shadow: 0 0 0 3px rgba(83,230,212,.07); }

        /* sheet close */
        .close-x:hover { background: rgba(255,255,255,.12) !important; }

        /* copy btn */
        .copy-btn:hover { background: rgba(83,230,212,.15) !important; }

        /* back link */
        .back-link:hover { color: var(--gray) !important; }
        .back-link:hover .arrow { transform: translateX(-3px); }
        .arrow { transition: transform .14s; }

        /* scrollbar */
        .scroll::-webkit-scrollbar { width: 3px; }
        .scroll::-webkit-scrollbar-thumb { background: rgba(83,230,212,.2); border-radius: 4px; }

        /* stat card */
        .stat-card { transition: transform .15s; }
        .stat-card:hover { transform: translateY(-2px); }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)' }}>

        {/* ─── NAV ─── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,230,212,.08)' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/dashboard" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft className="arrow" style={{ width: 16, height: 16 }} />
              Back
            </Link>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--gray)' }}>Transactions</span>
            {wallet && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 9, color: 'rgba(83,230,212,.5)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Balance</p>
                <p style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--mint)' }}>₦{fmt(wallet.balance)}</p>
              </div>
            )}
          </div>
        </nav>

        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 100px' }}>

          {/* ── STAT CARDS ── */}
          <div className="a1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total',      value: stats.total,      bg: 'rgba(96,165,250,.08)',  color: '#60a5fa',  border: 'rgba(96,165,250,.18)'  },
              { label: 'Success',    value: stats.successful, bg: 'rgba(74,222,128,.08)',  color: '#4ade80',  border: 'rgba(74,222,128,.18)'  },
              { label: 'Pending',    value: stats.pending,    bg: 'rgba(250,204,21,.08)',  color: '#facc15',  border: 'rgba(250,204,21,.18)'  },
              { label: 'Failed',     value: stats.failed,     bg: 'rgba(248,113,113,.08)', color: '#f87171',  border: 'rgba(248,113,113,.18)' },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 16, padding: '14px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'var(--mono)', lineHeight: 1, marginBottom: 4 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── SEARCH + FILTERS ── */}
          <div className="a2" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 18, padding: '16px', marginBottom: 20 }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'rgba(244,247,247,.3)' }} />
              <input
                className="search-input"
                type="text"
                placeholder="Search reference, phone, network…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 12, paddingLeft: 38, paddingRight: 14, paddingTop: 10, paddingBottom: 10, color: 'var(--gray)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', transition: 'border-color .2s, box-shadow .2s' }}
              />
            </div>
            {/* Filter chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <Filter style={{ width: 13, height: 13, color: 'rgba(244,247,247,.3)', flexShrink: 0 }} />
              {['all','deposit','airtime','data','withdrawal','success','pending','failed'].map(f => {
                const active = filterType === f;
                return (
                  <button key={f} className={`chip${active ? ' chip-active' : ''}`}
                    onClick={() => setFilterType(f)}
                    style={{ padding: '6px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', background: active ? 'var(--mint)' : 'rgba(255,255,255,.04)', color: active ? 'var(--carbon)' : 'var(--muted)', border: `1px solid ${active ? 'transparent' : 'var(--border)'}` }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── GROUPED TRANSACTION LIST ── */}
          <div className="a3">
            {filtered.length === 0 ? (
              <div style={{ background: 'var(--carbon)', border: '1px dashed rgba(255,255,255,.08)', borderRadius: 18, padding: '44px 20px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Search style={{ width: 22, height: 22, color: 'rgba(244,247,247,.18)' }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(244,247,247,.35)' }}>
                  {searchQuery ? 'No matching transactions' : 'No transactions yet'}
                </p>
                {!searchQuery && (
                  <Link href="/dashboard/fund"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, background: 'var(--mint)', color: 'var(--carbon)', borderRadius: 12, padding: '10px 20px', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
                    <Wallet style={{ width: 14, height: 14 }} /> Fund Wallet
                  </Link>
                )}
              </div>
            ) : (
              grouped.map((group, gi) => (
                <div key={gi} style={{ marginBottom: 24 }}>
                  {/* Month header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray)', letterSpacing: '-.01em' }}>{group.label}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 11, color: '#4ade80', fontFamily: 'var(--mono)', fontWeight: 700 }}>In: +₦{group.inflow.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      <span style={{ fontSize: 11, color: 'rgba(244,247,247,.35)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Out: -₦{group.outflow.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Transactions card */}
                  <div style={{ background: 'var(--carbon)', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.05)' }}>
                    {group.txs.map((tx, ti) => {
                      const meta    = TX_META[tx.type] || DEFAULT_META;
                      const isCredit = tx.type === 'deposit';
                      const ok      = tx.status === 'success' || tx.status === 'completed';
                      const pend    = tx.status === 'pending';
                      const net     = tx.network ? NET_COLOR[tx.network] : null;
                      const d       = new Date(tx.created_at);
                      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      return (
                        <div key={tx.id} className="tx-row"
                          onClick={() => setSelected(tx)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: ti < group.txs.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}
                        >
                          <TxIcon type={tx.type} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>
                                {net && <span style={{ fontSize: 10, fontWeight: 700, color: net.color, background: net.bg, padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>{tx.network!.toUpperCase()}</span>}
                                {meta.label}
                              </span>
                            </div>
                            <p style={{ fontSize: 10, color: 'rgba(244,247,247,.3)', fontFamily: 'var(--mono)' }}>
                              {dateStr}, {timeStr}
                            </p>
                          </div>

                          {/* Right */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: isCredit ? '#4ade80' : 'var(--gray)', marginBottom: 4 }}>
                              {isCredit ? '+' : '-'}₦{fmt(tx.amount)}
                            </p>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', padding: '3px 7px', borderRadius: 5, background: ok ? 'rgba(34,197,94,.1)' : pend ? 'rgba(250,204,21,.1)' : 'rgba(239,68,68,.1)', color: ok ? '#4ade80' : pend ? '#facc15' : '#f87171', border: `1px solid ${ok ? 'rgba(34,197,94,.18)' : pend ? 'rgba(250,204,21,.18)' : 'rgba(239,68,68,.18)'}` }}>
                              {ok ? 'Successful' : tx.status}
                            </span>
                          </div>

                          <ChevronRight style={{ width: 14, height: 14, color: 'rgba(244,247,247,.18)', flexShrink: 0 }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── LOAD MORE ── */}
          {hasMore && (
            <div className="a4" style={{ textAlign: 'center', marginTop: 20 }}>
              <button className="load-more" onClick={() => setPage(p => p + 1)} disabled={loading}
                style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '12px 28px', fontSize: 13, fontWeight: 700, color: 'var(--muted)', fontFamily: 'var(--font)', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: loading ? .6 : 1 }}
              >
                {loading
                  ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(83,230,212,.3)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Loading…</>
                  : <><ChevronRight style={{ width: 14, height: 14 }} /> Load more</>
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
           TRANSACTION DETAIL BOTTOM SHEET
      ══════════════════════════════════════ */}
      {selected && selMeta && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.78)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'scrim .2s ease' }}
        >
          <div style={{ background: 'var(--primary-mid)', borderRadius: '26px 26px 0 0', maxWidth: 680, width: '100%', margin: '0 auto', animation: 'sheetUp .3s cubic-bezier(.32,.72,0,1)', border: '1px solid var(--mint-border)', borderBottom: 'none', fontFamily: 'var(--font)', color: 'var(--gray)', maxHeight: '85vh', overflowY: 'auto' }}>

            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px', position: 'sticky', top: 0, background: 'var(--primary-mid)' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(83,230,212,.25)' }} />
            </div>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 22px 16px', position: 'sticky', top: 22, background: 'var(--primary-mid)', zIndex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray)' }}>Transaction Details</span>
              <button className="close-x" onClick={() => setSelected(null)}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .14s' }}>
                <X style={{ width: 15, height: 15, color: 'var(--muted)' }} />
              </button>
            </div>

            {/* Hero: icon + label + amount + status */}
            <div style={{ textAlign: 'center', padding: '4px 22px 24px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: selMeta.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '1px solid rgba(255,255,255,.06)' }}>
                {(() => {
                  const Icon = selected.type === 'deposit' ? ArrowDownLeft
                    : selected.type === 'withdrawal' ? ArrowUpRight
                    : selected.type === 'airtime'    ? Phone
                    : selected.type === 'data'       ? Wifi
                    : Sparkles;
                  return <Icon style={{ width: 26, height: 26, color: selMeta.iconColor }} />;
                })()}
              </div>

              <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>
                {selNet
                  ? <span style={{ color: selNet.color, background: selNet.bg, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, marginRight: 6 }}>{selected.network!.toUpperCase()}</span>
                  : null
                }
                {selMeta.label}
              </p>

              <p style={{ fontSize: 34, fontWeight: 900, fontFamily: 'var(--mono)', color: selOk ? (selected.type === 'deposit' ? '#4ade80' : 'var(--gray)') : selPend ? '#facc15' : '#f87171', letterSpacing: '-.02em' }}>
                {selected.type === 'deposit' ? '+' : '-'}₦{fmt(selected.amount)}
              </p>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '6px 14px', borderRadius: 20, background: selOk ? 'rgba(34,197,94,.1)' : selPend ? 'rgba(250,204,21,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${selOk ? 'rgba(34,197,94,.22)' : selPend ? 'rgba(250,204,21,.22)' : 'rgba(239,68,68,.22)'}` }}>
                {selOk   && <CheckCircle2 style={{ width: 14, height: 14, color: '#4ade80' }} />}
                {!selOk  && <XCircle style={{ width: 14, height: 14, color: selPend ? '#facc15' : '#f87171' }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: selOk ? '#4ade80' : selPend ? '#facc15' : '#f87171', textTransform: 'capitalize' }}>
                  {selOk ? 'Successful' : selected.status}
                </span>
              </div>
            </div>

            {/* Detail rows */}
            <div style={{ padding: '4px 22px' }}>
              {[
                selected.phone_number && { label: 'Phone Number', val: selected.phone_number },
                { label: 'Transaction Date', val: new Date(selected.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
                { label: 'Type', val: selMeta.label },
                selected.network && { label: 'Network', val: selected.network.toUpperCase() },
              ].filter(Boolean).map((row: any, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>{row.val}</span>
                </div>
              ))}

              {/* Reference row — with copy */}
              <div style={{ padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>Transaction No.</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--gray)', textAlign: 'right', wordBreak: 'break-all' }}>{selected.reference}</span>
                    <button className="copy-btn" onClick={() => copyRef(selected.reference)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(83,230,212,.08)', border: '1px solid var(--mint-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .14s' }}>
                      {copied ? <Check style={{ width: 13, height: 13, color: 'var(--mint)' }} /> : <Copy style={{ width: 13, height: 13, color: 'var(--mint)' }} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Amount row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray)' }}>Amount</span>
                <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--mono)', color: selected.type === 'deposit' ? '#4ade80' : 'var(--mint)' }}>
                  {selected.type === 'deposit' ? '+' : '-'}₦{fmt(selected.amount)}
                </span>
              </div>
            </div>

            {/* Close button */}
            <div style={{ padding: '4px 22px 36px' }}>
              <button onClick={() => setSelected(null)}
                style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, height: 50, fontSize: 14, fontWeight: 700, color: 'var(--muted)', fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all .15s' }}
                onMouseOver={(e) => { (e.currentTarget.style.background = 'rgba(255,255,255,.1)'); (e.currentTarget.style.color = 'var(--gray)'); }}
                onMouseOut={(e)  => { (e.currentTarget.style.background = 'rgba(255,255,255,.06)'); (e.currentTarget.style.color = 'var(--muted)'); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}