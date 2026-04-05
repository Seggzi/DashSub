'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  RefreshCw, Search, ToggleLeft, ToggleRight,
  TrendingUp, Package, CheckCircle2, XCircle,
  ChevronDown, Save, Loader2, Percent, Filter,
  Wifi, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  network_id: string;
  network_name: string;
  plan_code: string;
  plan_name: string;
  plan_type: string;
  cost_price: number;
  selling_price: number;
  duration: string;
  is_active: boolean;
}

const NETWORK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  MTN:     { color: '#FACC15', bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.25)' },
  GLO:     { color: '#22C55E', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)'  },
  AIRTEL:  { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)'  },
  '9MOBILE':{ color: '#53E6D4', bg: 'rgba(83,230,212,0.10)', border: 'rgba(83,230,212,0.25)' },
};

const NETWORKS = ['ALL', 'MTN', 'GLO', 'AIRTEL', '9MOBILE'];
const MARKUP_PRESETS = [5, 10, 15, 20];

export default function AdminPlans() {
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [saving, setSaving]         = useState<string | null>(null);
  const [network, setNetwork]       = useState('ALL');
  const [search, setSearch]         = useState('');
  const [applyingMarkup, setApplyingMarkup] = useState(false);

  // Inline edit state
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState('');

  useEffect(() => { fetchPlans(); }, []);

  async function fetchPlans() {
    setLoading(true);
    const { data, error } = await supabase
      .from('data_plans')
      .select('*')
      .order('network_name')
      .order('cost_price', { ascending: true });
    if (error) toast.error('Failed to load plans');
    else setPlans(data || []);
    setLoading(false);
  }

  async function toggleActive(plan: Plan) {
    const { error } = await supabase
      .from('data_plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id);
    if (error) { toast.error('Failed to update'); return; }
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: !p.is_active } : p));
    toast.success(`Plan ${!plan.is_active ? 'activated' : 'deactivated'}`);
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setEditValue(String(plan.selling_price));
  }

  async function saveEdit(plan: Plan) {
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) { toast.error('Invalid price'); return; }
    setSaving(plan.id);
    const { error } = await supabase
      .from('data_plans')
      .update({ selling_price: val })
      .eq('id', plan.id);
    setSaving(null);
    if (error) { toast.error('Failed to save'); return; }
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, selling_price: val } : p));
    setEditingId(null);
    toast.success('Price updated ✓');
  }

  async function applyMarkupToNetwork(percent: number) {
    const targets = network === 'ALL' ? plans : plans.filter(p => p.network_name === network);
    if (!targets.length) return;
    if (!confirm(`Apply ${percent}% markup to ${targets.length} plans${network !== 'ALL' ? ` (${network})` : ''}?`)) return;

    setApplyingMarkup(true);
    let updated = 0;
    for (const plan of targets) {
      const newPrice = parseFloat((plan.cost_price * (1 + percent / 100)).toFixed(2));
      const { error } = await supabase
        .from('data_plans')
        .update({ selling_price: newPrice })
        .eq('id', plan.id);
      if (!error) updated++;
    }
    setApplyingMarkup(false);
    await fetchPlans();
    toast.success(`✅ Applied ${percent}% markup to ${updated} plans`);
  }

  async function syncPlans() {
    setSyncing(true);
    try {
      const res  = await fetch('/api/sync-plans', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        await fetchPlans();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch {
      toast.error('Network error during sync');
    }
    setSyncing(false);
  }

  const filtered = useMemo(() => {
    let list = network === 'ALL' ? plans : plans.filter(p => p.network_name === network);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.plan_name.toLowerCase().includes(q) ||
        p.plan_code.includes(q) ||
        p.plan_type?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [plans, network, search]);

  const stats = useMemo(() => ({
    total:    plans.length,
    active:   plans.filter(p => p.is_active).length,
    inactive: plans.filter(p => !p.is_active).length,
    networks: [...new Set(plans.map(p => p.network_name))].length,
  }), [plans]);

  const profit = (plan: Plan) => plan.selling_price - plan.cost_price;
  const margin = (plan: Plan) => plan.cost_price > 0
    ? ((profit(plan) / plan.cost_price) * 100).toFixed(1)
    : '0';

  return (
    <>
      <style>{`
        .plans-table tbody tr { transition: background .12s; }
        .plans-table tbody tr:hover { background: rgba(83,230,212,0.03) !important; }
        .price-input:focus { outline: none; border-color: #53E6D4 !important; box-shadow: 0 0 0 3px rgba(83,230,212,0.12); }
        .net-chip { transition: all .14s; cursor: pointer; }
        .net-chip:hover { transform: translateY(-1px); }
        .markup-btn { transition: all .14s; }
        .markup-btn:hover { background: rgba(83,230,212,0.15) !important; transform: translateY(-1px); }
        .toggle-btn { transition: all .15s; cursor: pointer; }
        .toggle-btn:hover { filter: brightness(1.15); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; }
      `}</style>

      <div style={{ color: '#F4F7F7', fontFamily: "'Sora', sans-serif" }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-.02em' }}>
              Data Plans
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.45)', fontWeight: 500 }}>
              Manage pricing for all networks · GladTidings API
            </p>
          </div>
          <button
            onClick={syncPlans}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, background: '#53E6D4', border: 'none', cursor: syncing ? 'not-allowed' : 'pointer', color: '#0D2E2E', fontSize: 13, fontWeight: 800, opacity: syncing ? 0.7 : 1 }}
          >
            <RefreshCw style={{ width: 15, height: 15 }} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Plans'}
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Plans', value: stats.total,    icon: Package,      color: '#53E6D4' },
            { label: 'Active',      value: stats.active,   icon: CheckCircle2, color: '#4ade80' },
            { label: 'Inactive',    value: stats.inactive, icon: XCircle,      color: '#f87171' },
            { label: 'Networks',    value: stats.networks, icon: Wifi,         color: '#FACC15' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ background: 'rgba(13,46,46,0.6)', border: '1px solid rgba(83,230,212,0.1)', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em' }}>{label}</p>
                <Icon style={{ width: 16, height: 16, color }} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18, marginBottom: 18 }}>

          {/* Network filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {NETWORKS.map(n => {
              const nc   = NETWORK_COLORS[n];
              const active = network === n;
              const count  = n === 'ALL' ? plans.length : plans.filter(p => p.network_name === n).length;
              return (
                <button key={n} className="net-chip"
                  onClick={() => setNetwork(n)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${active ? (nc?.border ?? 'rgba(83,230,212,0.3)') : 'rgba(255,255,255,0.08)'}`, background: active ? (nc?.bg ?? 'rgba(83,230,212,0.12)') : 'transparent', color: active ? (nc?.color ?? '#53E6D4') : 'rgba(244,247,247,0.45)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  {n}
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 8, fontWeight: 800 }}>{count}</span>
                </button>
              );
            })}

            {/* Search */}
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(244,247,247,0.3)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search plans…"
                style={{ paddingLeft: 34, paddingRight: 14, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 200 }}
              />
            </div>
          </div>

          {/* Markup quick-apply */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(244,247,247,0.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Percent style={{ width: 12, height: 12 }} />
              Quick Markup {network !== 'ALL' ? `(${network})` : '(All)'}:
            </span>
            {MARKUP_PRESETS.map(pct => (
              <button key={pct} className="markup-btn"
                onClick={() => applyMarkupToNetwork(pct)}
                disabled={applyingMarkup}
                style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(83,230,212,0.25)', background: 'transparent', color: '#53E6D4', fontSize: 12, fontWeight: 800, cursor: applyingMarkup ? 'not-allowed' : 'pointer', opacity: applyingMarkup ? 0.5 : 1 }}>
                +{pct}%
              </button>
            ))}
            {applyingMarkup && (
              <span style={{ fontSize: 12, color: '#53E6D4', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 style={{ width: 13, height: 13 }} className="spin" /> Applying…
              </span>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <Loader2 style={{ width: 28, height: 28, color: '#53E6D4', margin: '0 auto 12px' }} className="spin" />
              <p style={{ color: 'rgba(244,247,247,0.4)', fontSize: 13 }}>Loading plans…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <AlertTriangle style={{ width: 28, height: 28, color: 'rgba(244,247,247,0.2)', margin: '0 auto 12px' }} />
              <p style={{ color: 'rgba(244,247,247,0.35)', fontSize: 13 }}>No plans found</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="plans-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Network', 'Plan', 'Type', 'Duration', 'Cost Price', 'Selling Price', 'Margin', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.35)', textTransform: 'uppercase', letterSpacing: '.1em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(plan => {
                    const nc      = NETWORK_COLORS[plan.network_name] ?? NETWORK_COLORS['9MOBILE'];
                    const isEdit  = editingId === plan.id;
                    const isSave  = saving === plan.id;
                    const pct     = parseFloat(margin(plan));
                    const pctColor = pct >= 15 ? '#4ade80' : pct >= 10 ? '#facc15' : '#f87171';

                    return (
                      <tr key={plan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

                        {/* Network */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: 8, background: nc.bg, border: `1px solid ${nc.border}`, color: nc.color, fontSize: 11, fontWeight: 800 }}>
                            {plan.network_name}
                          </span>
                        </td>

                        {/* Plan name */}
                        <td style={{ padding: '13px 16px' }}>
                          <p style={{ color: '#F4F7F7', fontWeight: 700, marginBottom: 2 }}>{plan.plan_name}</p>
                          <p style={{ color: 'rgba(244,247,247,0.3)', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>#{plan.plan_code}</p>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ color: 'rgba(244,247,247,0.45)', fontSize: 11 }}>{plan.plan_type ?? '—'}</span>
                        </td>

                        {/* Duration */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ color: 'rgba(244,247,247,0.55)', fontSize: 12 }}>{plan.duration}</span>
                        </td>

                        {/* Cost price */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ color: 'rgba(244,247,247,0.5)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                            ₦{plan.cost_price.toLocaleString()}
                          </span>
                        </td>

                        {/* Selling price — inline edit */}
                        <td style={{ padding: '13px 16px' }}>
                          {isEdit ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                className="price-input"
                                type="number"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(plan); if (e.key === 'Escape') setEditingId(null); }}
                                autoFocus
                                style={{ width: 100, padding: '6px 10px', borderRadius: 8, border: '1.5px solid rgba(83,230,212,0.3)', background: 'rgba(83,230,212,0.06)', color: '#53E6D4', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}
                              />
                              <button onClick={() => saveEdit(plan)} disabled={isSave}
                                style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(74,222,128,0.15)', border: 'none', cursor: 'pointer', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                                {isSave ? <Loader2 style={{ width: 13, height: 13 }} className="spin" /> : <Save style={{ width: 13, height: 13 }} />}
                              </button>
                              <button onClick={() => setEditingId(null)}
                                style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(248,113,113,0.12)', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 12 }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(plan)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#53E6D4', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                              ₦{plan.selling_price.toLocaleString()}
                              <span style={{ fontSize: 9, color: 'rgba(83,230,212,0.4)', fontFamily: 'sans-serif' }}>✎</span>
                            </button>
                          )}
                        </td>

                        {/* Margin */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: pctColor, fontFamily: "'IBM Plex Mono', monospace" }}>+{pct}%</span>
                            <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.3)' }}>₦{profit(plan).toLocaleString('en-NG', { minimumFractionDigits: 0 })}</span>
                          </div>
                        </td>

                        {/* Active toggle */}
                        <td style={{ padding: '13px 16px' }}>
                          <button className="toggle-btn" onClick={() => toggleActive(plan)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: plan.is_active ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', color: plan.is_active ? '#4ade80' : '#f87171', fontSize: 11, fontWeight: 700 }}>
                            {plan.is_active
                              ? <><ToggleRight style={{ width: 15, height: 15 }} /> Active</>
                              : <><ToggleLeft  style={{ width: 15, height: 15 }} /> Off</>}
                          </button>
                        </td>

                        {/* Plan code pill */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.2)', fontFamily: "'IBM Plex Mono', monospace" }}>
                            ID:{plan.plan_code}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(244,247,247,0.3)' }}>
                Showing <strong style={{ color: '#53E6D4' }}>{filtered.length}</strong> of <strong style={{ color: '#53E6D4' }}>{plans.length}</strong> plans
              </span>
              <span style={{ fontSize: 11, color: 'rgba(244,247,247,0.2)' }}>
                Click selling price to edit · Click status to toggle
              </span>
            </div>
          )}
        </div>

      </div>
    </>
  );
}