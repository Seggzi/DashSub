"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Users, AlertTriangle, Activity, RefreshCw,
  ArrowUpRight, Clock, CheckCircle2, Loader2,
  DollarSign, ShoppingCart, BarChart2, TrendingUp,
  TrendingDown, Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashStats {
  totalUsers: number;
  newUsersToday: number;
  totalRevenue: number;
  revenueToday: number;
  totalTransactions: number;
  txToday: number;
  successRate: number;
  lowBalanceCount: number;
  avgOrderValue: number;
  pendingCount: number;
}

interface Transaction {
  id: string;
  user_id: string;
  network: string;
  plan_name: string;
  amount: number;
  phone: string;
  status: "success" | "failed" | "pending";
  created_at: string;
  profiles?: { email: string; full_name: string };
}

interface LowBalanceUser {
  id: string;
  email: string;
  full_name: string;
  wallet_balance: number;
}

interface NetworkBreakdown {
  name: string;
  count: number;
  revenue: number;
}

interface DayRevenue {
  label: string;
  dateStr: string; // "YYYY-MM-DD" for reliable matching
  revenue: number;
  count: number;
  isToday: boolean;
}

// ─── Network helper (handles all raw values from DB) ─────────────────────────

const NETWORK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  MTN:       { color: "#FACC15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)" },
  GLO:       { color: "#22C55E", bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.25)"  },
  AIRTEL:    { color: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)"  },
  "9MOBILE": { color: "#53E6D4", bg: "rgba(83,230,212,0.10)",  border: "rgba(83,230,212,0.25)" },
  UNKNOWN:   { color: "#888",    bg: "rgba(136,136,136,0.08)", border: "rgba(136,136,136,0.15)"},
};

function normalizeNetwork(raw: string | null | undefined): string {
  if (!raw) return "UNKNOWN";
  const v = raw.trim().toUpperCase();
  if (v === "MTN") return "MTN";
  if (v === "GLO") return "GLO";
  if (v === "AIRTEL" || v === "02") return "AIRTEL";
  if (v === "9MOBILE" || v === "01" || v === "1") return "9MOBILE";
  return "UNKNOWN";
}

function getNC(raw: string | null | undefined) {
  return NETWORK_COLORS[normalizeNetwork(raw)] ?? NETWORK_COLORS["UNKNOWN"];
}

// ─── Other constants ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  success: { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  label: "Success" },
  failed:  { color: "#f87171", bg: "rgba(248,113,113,0.12)", label: "Failed"  },
  pending: { color: "#facc15", bg: "rgba(250,204,21,0.12)",  label: "Pending" },
};

const LOW_BALANCE_THRESHOLD = 500;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-NG", { minimumFractionDigits: 0 });
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// FIX: use dateStr "YYYY-MM-DD" for reliable day matching instead of ISO timestamp
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getLast7Days(): DayRevenue[] {
  const todayStr = toDateStr(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = toDateStr(d);
    return {
      label:   DAY_LABELS[d.getDay()],
      dateStr,
      revenue: 0,
      count:   0,
      isToday: dateStr === todayStr,
    };
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, loading, trend }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; loading?: boolean;
  trend?: "up" | "down";
}) {
  return (
    <div style={{ background: "rgba(13,46,46,0.6)", border: "1px solid rgba(83,230,212,0.10)", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.4)", textTransform: "uppercase", letterSpacing: ".12em" }}>{label}</p>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 14, height: 14, color }} />
        </div>
      </div>
      {loading ? (
        <div style={{ height: 36, display: "flex", alignItems: "center" }}>
          <Loader2 style={{ width: 16, height: 16, color: "#53E6D4", animation: "spin .8s linear infinite" }} />
        </div>
      ) : (
        <>
          <p style={{ fontSize: 26, fontWeight: 900, color, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1, marginBottom: 8 }}>{value}</p>
          {sub && (
            <p style={{ fontSize: 11, color: "rgba(244,247,247,0.35)", display: "flex", alignItems: "center", gap: 4 }}>
              {trend === "up"   && <TrendingUp   style={{ width: 11, height: 11, color: "#4ade80" }} />}
              {trend === "down" && <TrendingDown style={{ width: 11, height: 11, color: "#f87171" }} />}
              {sub}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── 7-Day Revenue Chart ──────────────────────────────────────────────────────

function RevenueChart({ data, loading }: { data: DayRevenue[]; loading: boolean }) {
  const maxRev = Math.max(...data.map(d => d.revenue), 1);
  const total  = data.reduce((s, d) => s + d.revenue, 0);
  const prev   = data.slice(0, 3).reduce((s, d) => s + d.revenue, 0);
  const last   = data.slice(4).reduce((s, d) => s + d.revenue, 0);
  const trend  = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;

  return (
    <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp style={{ width: 15, height: 15, color: "#53E6D4" }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#F4F7F7" }}>7-Day Revenue</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", fontFamily: "'IBM Plex Mono', monospace" }}>₦{fmt(total)}</p>
          {trend !== 0 && (
            <p style={{ fontSize: 11, color: trend > 0 ? "#4ade80" : "#f87171", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", marginTop: 2 }}>
              {trend > 0 ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
              {Math.abs(trend)}% vs prev period
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 style={{ width: 22, height: 22, color: "#53E6D4", animation: "spin .8s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingBottom: 28, position: "relative" }}>
          {[0, 50, 100].map(pct => (
            <div key={pct} style={{ position: "absolute", left: 0, right: 0, bottom: `calc(28px + ${pct / 100} * 92px)`, borderTop: "1px dashed rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          ))}
          {data.map(d => {
            const barH = maxRev > 0 ? Math.max(4, Math.round((92 * d.revenue) / maxRev)) : 4;
            return (
              <div key={d.dateStr} style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div title={`₦${fmt(d.revenue)} · ${d.count} tx`} style={{
                  position: "absolute", bottom: 22, width: "100%", height: barH,
                  background: d.isToday ? "rgba(83,230,212,0.75)" : d.revenue > 0 ? "rgba(83,230,212,0.3)" : "rgba(255,255,255,0.05)",
                  borderRadius: "4px 4px 0 0",
                  border: d.isToday ? "1px solid rgba(83,230,212,0.5)" : "none",
                  transition: "height .4s cubic-bezier(.4,0,.2,1)",
                  cursor: "default",
                }} />
                <span style={{ position: "absolute", bottom: 0, fontSize: 10, fontWeight: d.isToday ? 800 : 500, color: d.isToday ? "#53E6D4" : "rgba(244,247,247,0.3)" }}>
                  {/* FIX: use isToday flag set at build time, not a label string comparison */}
                  {d.isToday ? "Today" : d.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {data.slice(-3).map(d => (
          <div key={d.dateStr} style={{ flex: 1 }}>
            <p style={{ fontSize: 10, color: "rgba(244,247,247,0.3)", marginBottom: 2 }}>{d.isToday ? "Today" : d.label}</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#F4F7F7", fontFamily: "'IBM Plex Mono', monospace" }}>
              ₦{d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : fmt(d.revenue)}
            </p>
          </div>
        ))}
        <div style={{ flex: 1, textAlign: "right" }}>
          <p style={{ fontSize: 10, color: "rgba(244,247,247,0.3)", marginBottom: 2 }}>Avg/day</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#53E6D4", fontFamily: "'IBM Plex Mono', monospace" }}>₦{fmt(Math.round(total / 7))}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [stats, setStats]               = useState<DashStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lowBalance, setLowBalance]     = useState<LowBalanceUser[]>([]);
  const [networkData, setNetworkData]   = useState<NetworkBreakdown[]>([]);
  const [weekData, setWeekData]         = useState<DayRevenue[]>(getLast7Days());
  const [loading, setLoading]           = useState(true);
  const [lastUpdated, setLastUpdated]   = useState<Date>(new Date());
  const [liveCount, setLiveCount]       = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    await Promise.all([fetchStats(), fetchRecentTx(), fetchLowBalance(), fetchNetworkBreakdown(), fetch7DayRevenue()]);
    setLastUpdated(new Date());
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    setupRealtime();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  // ── fetchStats: use auth.users count for accuracy ─────────────────────────
  async function fetchStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [
      { data: allProfiles },          // get all profiles for accurate count
      { count: newUsersToday },
      { data: allTx },
      { data: todayTx },
      { data: lowBal },
    ] = await Promise.all([
      supabase.from("profiles").select("id"),              // FIX: select rows not count
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", todayISO),
      supabase.from("transactions").select("amount, status"),
      supabase.from("transactions").select("amount, status").gte("created_at", todayISO),
      supabase.from("profiles").select("id").lt("wallet_balance", LOW_BALANCE_THRESHOLD),
    ]);

    const totalUsers    = allProfiles?.length ?? 0;         // FIX: count from array length
    const successTx     = (allTx || []).filter(t => t.status === "success");
    const revenue       = successTx.reduce((s, t) => s + (t.amount ?? 0), 0);
    const revenueToday  = (todayTx || []).filter(t => t.status === "success").reduce((s, t) => s + (t.amount ?? 0), 0);
    const successRate   = allTx?.length ? Math.round((successTx.length / allTx.length) * 100) : 0;
    const avgOrderValue = successTx.length > 0 ? Math.round(revenue / successTx.length) : 0;
    const pendingCount  = (allTx || []).filter(t => t.status === "pending").length;

    setStats({ totalUsers, newUsersToday: newUsersToday ?? 0, totalRevenue: revenue, revenueToday, totalTransactions: allTx?.length ?? 0, txToday: todayTx?.length ?? 0, successRate, lowBalanceCount: lowBal?.length ?? 0, avgOrderValue, pendingCount });
  }

  async function fetchRecentTx() {
    const { data, error } = await supabase.from("transactions").select("*, profiles(email, full_name)").order("created_at", { ascending: false }).limit(10);
    if (!error) setTransactions(data || []);
  }

  async function fetchLowBalance() {
    const { data, error } = await supabase.from("profiles").select("id, email, full_name, wallet_balance").lt("wallet_balance", LOW_BALANCE_THRESHOLD).order("wallet_balance", { ascending: true }).limit(8);
    if (!error) setLowBalance(data || []);
  }

  async function fetchNetworkBreakdown() {
    const { data, error } = await supabase.from("transactions").select("network, amount, status").eq("status", "success");
    if (error || !data) return;
    const map: Record<string, { count: number; revenue: number }> = {};
    data.forEach(t => {
      const key = normalizeNetwork(t.network); // FIX: normalize before grouping
      if (!map[key]) map[key] = { count: 0, revenue: 0 };
      map[key].count++;
      map[key].revenue += t.amount ?? 0;
    });
    setNetworkData(Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue));
  }

  async function fetch7DayRevenue() {
    const days  = getLast7Days();
    const since = days[0].dateStr + "T00:00:00.000Z";
    const { data, error } = await supabase.from("transactions").select("amount, status, created_at").eq("status", "success").gte("created_at", since);
    if (error || !data) return;
    data.forEach(tx => {
      const ds = toDateStr(new Date(tx.created_at)); // FIX: match by "YYYY-MM-DD"
      const day = days.find(d => d.dateStr === ds);
      if (day) { day.revenue += tx.amount ?? 0; day.count++; }
    });
    setWeekData([...days]);
  }

  function setupRealtime() {
    channelRef.current = supabase
      .channel("admin-dashboard-v3")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        const tx = payload.new as Transaction;
        setTransactions(prev => [tx, ...prev.slice(0, 9)]);
        setLiveCount(c => c + 1);
        setLastUpdated(new Date());
        fetchStats(); fetchNetworkBreakdown(); fetch7DayRevenue();
        toast.success(`New tx · ${normalizeNetwork(tx.network)} · ₦${fmt(tx.amount)}`, { duration: 3000 });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, (payload) => {
        const updated = payload.new as Transaction;
        setTransactions(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
        fetchStats(); fetchNetworkBreakdown(); fetch7DayRevenue();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => {
        fetchStats();
        toast.success("New user registered", { duration: 3000 });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchStats(); fetchLowBalance();
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") { toast.error("Realtime lost — refreshing…"); fetchAll(true); }
      });
  }

  function handleRefresh() { setLiveCount(0); fetchAll(); }

  const maxRevenue = useMemo(() => Math.max(...networkData.map(n => n.revenue), 1), [networkData]);

  return (
    <>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .live-dot { animation: pulse 1.4s ease-in-out infinite; }
        .tx-row   { transition: background .12s; animation: fadeIn .22s ease; }
        .tx-row:hover { background: rgba(83,230,212,0.03) !important; }
        .net-bar  { transition: width .5s cubic-bezier(.4,0,.2,1); }
        .ref-btn  { transition: all .14s; }
        .ref-btn:hover { background: rgba(83,230,212,0.15) !important; }
      `}</style>

      <div style={{ color: "#F4F7F7", fontFamily: "'Sora', sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-.02em" }}>Dashboard</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)" }}>Live overview · {lastUpdated.toLocaleTimeString()}</p>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#53E6D4", background: "rgba(83,230,212,0.08)", padding: "3px 8px", borderRadius: 8, border: "1px solid rgba(83,230,212,0.15)" }}>
                <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#53E6D4", display: "inline-block" }} />
                Realtime on{liveCount > 0 ? ` · ${liveCount} new` : ""}
              </span>
            </div>
          </div>
          <button onClick={handleRefresh} className="ref-btn" disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "rgba(83,230,212,0.08)", border: "1px solid rgba(83,230,212,0.2)", color: "#53E6D4", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? "spin .8s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {/* 4 Primary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
          <StatCard label="Total Users"    value={stats ? fmt(stats.totalUsers) : "—"}         sub={stats ? `+${stats.newUsersToday} today` : undefined}              icon={Users}        color="#53E6D4" loading={loading} trend="up" />
          <StatCard label="Total Revenue"  value={stats ? `₦${fmt(stats.totalRevenue)}` : "—"} sub={stats ? `₦${fmt(stats.revenueToday)} today` : undefined}          icon={DollarSign}   color="#4ade80" loading={loading} trend="up" />
          <StatCard label="Transactions"   value={stats ? fmt(stats.totalTransactions) : "—"}  sub={stats ? `${stats.txToday} today` : undefined}                      icon={ShoppingCart} color="#FACC15" loading={loading} />
          <StatCard label="Success Rate"   value={stats ? `${stats.successRate}%` : "—"}       sub={stats ? `${stats.pendingCount} pending` : undefined}                icon={Activity}     color={!stats ? "#53E6D4" : stats.successRate >= 90 ? "#4ade80" : stats.successRate >= 70 ? "#facc15" : "#f87171"} loading={loading} />
        </div>

        {/* 2 Secondary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label="Avg Order Value"  value={stats ? `₦${fmt(stats.avgOrderValue)}` : "—"} sub="per successful transaction"     icon={Zap}           color="#a78bfa" loading={loading} />
          <StatCard label="Low Balance Users" value={stats ? stats.lowBalanceCount : "—"}          sub={`Below ₦${fmt(LOW_BALANCE_THRESHOLD)}`} icon={AlertTriangle} color={stats && stats.lowBalanceCount > 0 ? "#f87171" : "#4ade80"} loading={loading} />
        </div>

        {/* 7-Day Chart */}
        <div style={{ marginBottom: 20 }}><RevenueChart data={weekData} loading={loading} /></div>

        {/* Network + Low Balance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

          <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <BarChart2 style={{ width: 15, height: 15, color: "#53E6D4" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#F4F7F7" }}>Network Breakdown</h2>
            </div>
            {loading ? (
              <div style={{ padding: "30px 0", textAlign: "center" }}><Loader2 style={{ width: 20, height: 20, color: "#53E6D4", margin: "0 auto", animation: "spin .8s linear infinite" }} /></div>
            ) : networkData.length === 0 ? (
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>No data yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {networkData.map(n => {
                  const nc    = NETWORK_COLORS[n.name] ?? NETWORK_COLORS["UNKNOWN"];
                  const pct   = Math.round((n.revenue / maxRevenue) * 100);
                  const share = Math.round((n.revenue / networkData.reduce((s, x) => s + x.revenue, 0)) * 100);
                  return (
                    <div key={n.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ padding: "2px 8px", borderRadius: 6, background: nc.bg, border: `1px solid ${nc.border}`, color: nc.color, fontSize: 11, fontWeight: 800 }}>{n.name}</span>
                          <span style={{ fontSize: 11, color: "rgba(244,247,247,0.3)" }}>{n.count} tx · {share}%</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: nc.color, fontFamily: "'IBM Plex Mono', monospace" }}>₦{fmt(n.revenue)}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                        <div className="net-bar" style={{ height: "100%", borderRadius: 4, background: nc.color, width: `${pct}%`, opacity: 0.75 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <AlertTriangle style={{ width: 14, height: 14, color: "#f87171" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#F4F7F7" }}>Low Balance Alerts</h2>
              {lowBalance.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 11, background: "rgba(248,113,113,0.1)", color: "#f87171", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(248,113,113,0.18)", fontWeight: 700 }}>{lowBalance.length} users</span>
              )}
            </div>
            {loading ? (
              <div style={{ padding: "30px 0", textAlign: "center" }}><Loader2 style={{ width: 20, height: 20, color: "#53E6D4", margin: "0 auto", animation: "spin .8s linear infinite" }} /></div>
            ) : lowBalance.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center" }}>
                <CheckCircle2 style={{ width: 20, height: 20, color: "#4ade80", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "rgba(244,247,247,0.35)" }}>All users above threshold</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lowBalance.map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.08)" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#F4F7F7", marginBottom: 2 }}>{u.full_name || "Unnamed"}</p>
                      <p style={{ fontSize: 11, color: "rgba(244,247,247,0.3)" }}>{u.email}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: u.wallet_balance <= 0 ? "#f87171" : "#facc15", fontFamily: "'IBM Plex Mono', monospace" }}>₦{fmt(u.wallet_balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
            <Activity style={{ width: 15, height: 15, color: "#53E6D4" }} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#F4F7F7" }}>Recent Transactions</h2>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#53E6D4" }}>
              <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#53E6D4", display: "inline-block" }} />
              Live
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "50px 0", textAlign: "center" }}>
              <Loader2 style={{ width: 22, height: 22, color: "#53E6D4", margin: "0 auto 10px", animation: "spin .8s linear infinite" }} />
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13 }}>Loading…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: "50px 0", textAlign: "center" }}>
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13 }}>No transactions yet</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["User", "Network", "Plan", "Amount", "Phone", "Status", "Time"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const nc = getNC(tx.network); // FIX: normalize
                    const sc = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
                    const netLabel = normalizeNetwork(tx.network);
                    return (
                      <tr key={tx.id} className="tx-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <p style={{ fontWeight: 600, color: "#F4F7F7", marginBottom: 2 }}>{tx.profiles?.full_name || "—"}</p>
                          <p style={{ fontSize: 11, color: "rgba(244,247,247,0.3)" }}>{tx.profiles?.email}</p>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 9px", borderRadius: 7, background: nc.bg, border: `1px solid ${nc.border}`, color: nc.color, fontSize: 11, fontWeight: 800 }}>{netLabel}</span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "rgba(244,247,247,0.5)", maxWidth: 160 }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.plan_name}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#4ade80" }}>₦{fmt(tx.amount)}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", color: "rgba(244,247,247,0.4)", fontSize: 12 }}>{tx.phone}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 7, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "rgba(244,247,247,0.3)", fontSize: 12, whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock style={{ width: 11, height: 11 }} />
                            {timeAgo(tx.created_at)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ padding: "12px 22px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(244,247,247,0.25)" }}>Last {transactions.length} · auto-updates via realtime</span>
            <a href="/admin/transactions" style={{ fontSize: 12, color: "#53E6D4", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
              View all <ArrowUpRight style={{ width: 12, height: 12 }} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}