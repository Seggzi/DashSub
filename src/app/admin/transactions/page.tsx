"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Search, RefreshCw, Filter, Download, Clock,
  CheckCircle2, XCircle, Loader2, AlertTriangle,
  ArrowUpRight, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: number;
  user_id: string;
  type: string;
  amount: number;
  status: "success" | "failed" | "pending";
  network: string;
  phone_number: string;
  plan_code: string | null;
  provider_reference: string | null;
  reference: string;
  description: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string };
}

type StatusFilter = "all" | "success" | "failed" | "pending";
type SortKey      = "created_at" | "amount";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const STATUS_CONFIG = {
  success: { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.2)",  icon: CheckCircle2, label: "Success" },
  failed:  { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.2)", icon: XCircle,      label: "Failed"  },
  pending: { color: "#facc15", bg: "rgba(250,204,21,0.12)",  border: "rgba(250,204,21,0.2)",  icon: Clock,        label: "Pending" },
};

const PAGE_SIZE = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-NG", { minimumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function TxDetail({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const nc = getNC(tx.network);
  const sc = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
  const netLabel = normalizeNetwork(tx.network);

  const rows = [
    { label: "Reference",          value: tx.reference },
    { label: "Provider Ref",       value: tx.provider_reference ?? "—" },
    { label: "Plan Code",          value: tx.plan_code ?? "—" },
    { label: "Type",               value: tx.type ?? "—" },
    { label: "Payment Method",     value: tx.payment_method ?? "—" },
    { label: "Phone",              value: tx.phone_number },
    { label: "Description",        value: tx.description ?? "—" },
    { label: "Created",            value: fmtDate(tx.created_at) },
    { label: "Updated",            value: fmtDate(tx.updated_at) },
    { label: "User",               value: tx.profiles?.full_name || "—" },
    { label: "Email",              value: tx.profiles?.email || "—" },
    { label: "User ID",            value: tx.user_id },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: "100%", maxWidth: 460, height: "100%", background: "#0D1F1F", borderLeft: "1px solid rgba(83,230,212,0.12)", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: "rgba(244,247,247,0.35)", marginBottom: 4 }}>Transaction Detail</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#53E6D4", fontFamily: "'IBM Plex Mono', monospace" }}>#{tx.reference}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: "rgba(244,247,247,0.5)" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Amount + Status */}
        <div style={{ padding: "24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, color: "rgba(244,247,247,0.35)", marginBottom: 6 }}>Amount</p>
            <p style={{ fontSize: 32, fontWeight: 900, color: "#4ade80", fontFamily: "'IBM Plex Mono', monospace" }}>₦{fmt(tx.amount)}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span style={{ padding: "5px 14px", borderRadius: 10, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 13, fontWeight: 800 }}>{sc.label}</span>
            <span style={{ padding: "4px 12px", borderRadius: 8, background: nc.bg, border: `1px solid ${nc.border}`, color: nc.color, fontSize: 12, fontWeight: 800 }}>{netLabel}</span>
          </div>
        </div>

        {/* Detail rows */}
        <div style={{ padding: "20px 24px" }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 16 }}>
              <span style={{ fontSize: 12, color: "rgba(244,247,247,0.35)", flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: "#F4F7F7", fontWeight: 600, textAlign: "right", wordBreak: "break-all", fontFamily: r.label.includes("ID") || r.label.includes("Ref") ? "'IBM Plex Mono', monospace" : "inherit" }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [networkFilter, setNetworkFilter] = useState("ALL");
  const [sortKey, setSortKey]           = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc]           = useState(false);
  const [page, setPage]                 = useState(1);
  const [detailTx, setDetailTx]         = useState<Transaction | null>(null);
  const [liveCount, setLiveCount]       = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // FIX: use API route with service role key — anon key is blocked by RLS
      const res = await fetch("/api/admin/get-transactions");
      const result = await res.json();
      if (!res.ok || result.error) {
        toast.error("Failed to load transactions: " + (result.error || "Unknown error"));
      } else {
        setTransactions(result.data || []);
      }
    } catch (err) {
      toast.error("Network error loading transactions");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
    channelRef.current = supabase
      .channel("admin-transactions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        setTransactions(prev => [payload.new as Transaction, ...prev]);
        setLiveCount(c => c + 1);
        toast.success(`New transaction · ₦${fmt((payload.new as Transaction).amount)}`, { duration: 3000 });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, (payload) => {
        setTransactions(prev => prev.map(t => t.id === (payload.new as Transaction).id ? { ...t, ...payload.new } : t));
      })
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  // ── Stats from loaded data ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = transactions.length;
    const success = transactions.filter(t => t.status === "success");
    const failed  = transactions.filter(t => t.status === "failed").length;
    const pending = transactions.filter(t => t.status === "pending").length;
    const revenue = success.reduce((s, t) => s + (t.amount ?? 0), 0);
    const rate    = total > 0 ? Math.round((success.length / total) * 100) : 0;
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const todayTx = transactions.filter(t => new Date(t.created_at) >= today).length;
    return { total, success: success.length, failed, pending, revenue, rate, todayTx };
  }, [transactions]);

  // ── Available networks from data ──────────────────────────────────────────
  const networks = useMemo(() => {
    const set = new Set(transactions.map(t => normalizeNetwork(t.network)));
    return ["ALL", ...Array.from(set).sort()];
  }, [transactions]);

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...transactions];
    if (statusFilter !== "all")  list = list.filter(t => t.status === statusFilter);
    if (networkFilter !== "ALL") list = list.filter(t => normalizeNetwork(t.network) === networkFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.reference?.toLowerCase().includes(q) ||
        t.phone_number?.includes(q) ||
        t.profiles?.full_name?.toLowerCase().includes(q) ||
        t.profiles?.email?.toLowerCase().includes(q) ||
        t.plan_code?.includes(q) ||
        String(t.amount)?.includes(q)
      );
    }
    list.sort((a, b) => {
      const av = sortKey === "amount" ? a.amount : new Date(a.created_at).getTime();
      const bv = sortKey === "amount" ? b.amount : new Date(b.created_at).getTime();
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [transactions, statusFilter, networkFilter, search, sortKey, sortAsc]);

  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function handleRefresh() { setLiveCount(0); fetchTransactions(); }

  function exportCSV() {
    const headers = ["ID", "Reference", "User", "Email", "Network", "Phone", "Type", "Amount", "Status", "Date"];
    const rows = filtered.map(t => [
      t.id, t.reference,
      t.profiles?.full_name ?? "", t.profiles?.email ?? "",
      normalizeNetwork(t.network), t.phone_number, t.type ?? "",
      t.amount, t.status, fmtDate(t.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success(`Exported ${filtered.length} transactions`);
  }

  return (
    <>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        .live-dot { animation: pulse 1.4s ease-in-out infinite; }
        .tx-row   { transition: background .12s; animation: fadeIn .18s ease; cursor: pointer; }
        .tx-row:hover { background: rgba(83,230,212,0.04) !important; }
        .filt-chip { transition: all .13s; cursor: pointer; }
        .filt-chip:hover { transform: translateY(-1px); }
        input::placeholder { color: rgba(244,247,247,0.25); }
      `}</style>

      {detailTx && <TxDetail tx={detailTx} onClose={() => setDetailTx(null)} />}

      <div style={{ color: "#F4F7F7", fontFamily: "'Sora', sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-.02em" }}>Transactions</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)" }}>{stats.total} total · {stats.todayTx} today</p>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#53E6D4", background: "rgba(83,230,212,0.08)", padding: "3px 8px", borderRadius: 8, border: "1px solid rgba(83,230,212,0.15)" }}>
                <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#53E6D4", display: "inline-block" }} />
                Live{liveCount > 0 ? ` · ${liveCount} new` : ""}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={exportCSV}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(244,247,247,0.6)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Download style={{ width: 14, height: 14 }} /> Export CSV
            </button>
            <button onClick={handleRefresh} disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "rgba(83,230,212,0.08)", border: "1px solid rgba(83,230,212,0.2)", color: "#53E6D4", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
              <RefreshCw style={{ width: 14, height: 14, animation: loading ? "spin .8s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Total",    value: stats.total,                    color: "#53E6D4" },
            { label: "Revenue",  value: `₦${fmt(stats.revenue)}`,       color: "#4ade80" },
            { label: "Success",  value: stats.success,                  color: "#4ade80" },
            { label: "Failed",   value: stats.failed,                   color: "#f87171" },
            { label: "Pending",  value: stats.pending,                  color: "#facc15" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "rgba(13,46,46,0.6)", border: "1px solid rgba(83,230,212,0.08)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.35)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>{label}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 18px", marginBottom: 16 }}>

          {/* Status filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Status:</span>
            {(["all", "success", "failed", "pending"] as StatusFilter[]).map(s => {
              const count = s === "all" ? stats.total : transactions.filter(t => t.status === s).length;
              const sc    = s !== "all" ? STATUS_CONFIG[s] : null;
              return (
                <button key={s} className="filt-chip" onClick={() => { setStatusFilter(s); setPage(1); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", borderRadius: 20, border: `1.5px solid ${statusFilter === s ? (sc?.border ?? "rgba(83,230,212,0.3)") : "rgba(255,255,255,0.07)"}`, background: statusFilter === s ? (sc?.bg ?? "rgba(83,230,212,0.1)") : "transparent", color: statusFilter === s ? (sc?.color ?? "#53E6D4") : "rgba(244,247,247,0.4)", fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
                  {s === "all" ? "All" : s}
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 6 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Network filters + Search */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Network:</span>
            {networks.map(n => {
              const nc    = n !== "ALL" ? (NETWORK_COLORS[n] ?? NETWORK_COLORS["UNKNOWN"]) : null;
              const count = n === "ALL" ? filtered.length : transactions.filter(t => normalizeNetwork(t.network) === n).length;
              return (
                <button key={n} className="filt-chip" onClick={() => { setNetworkFilter(n); setPage(1); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", borderRadius: 20, border: `1.5px solid ${networkFilter === n ? (nc?.border ?? "rgba(83,230,212,0.3)") : "rgba(255,255,255,0.07)"}`, background: networkFilter === n ? (nc?.bg ?? "rgba(83,230,212,0.08)") : "transparent", color: networkFilter === n ? (nc?.color ?? "#53E6D4") : "rgba(244,247,247,0.4)", fontSize: 12, fontWeight: 800 }}>
                  {n}
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 6 }}>{count}</span>
                </button>
              );
            })}

            <div style={{ marginLeft: "auto", position: "relative" }}>
              <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "rgba(244,247,247,0.25)" }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search ref, phone, name…"
                style={{ paddingLeft: 32, paddingRight: 14, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#F4F7F7", fontSize: 12, outline: "none", width: 220, fontFamily: "inherit" }} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <Loader2 style={{ width: 26, height: 26, color: "#53E6D4", margin: "0 auto 10px", animation: "spin .8s linear infinite" }} />
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13 }}>Loading transactions…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <AlertTriangle style={{ width: 26, height: 26, color: "rgba(244,247,247,0.15)", margin: "0 auto 10px" }} />
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13 }}>No transactions found</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {[
                      { label: "User",      sortable: false },
                      { label: "Network",   sortable: false },
                      { label: "Phone",     sortable: false },
                      { label: "Type",      sortable: false },
                      { label: "Amount",    sortable: true,  key: "amount"     },
                      { label: "Status",    sortable: false },
                      { label: "Reference", sortable: false },
                      { label: "Date",      sortable: true,  key: "created_at" },
                    ].map(h => (
                      <th key={h.label}
                        onClick={h.sortable ? () => { setSortKey(h.key as SortKey); setSortAsc(sortKey === h.key ? !sortAsc : false); setPage(1); } : undefined}
                        style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: h.sortable && sortKey === h.key ? "#53E6D4" : "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em", whiteSpace: "nowrap", cursor: h.sortable ? "pointer" : "default", userSelect: "none" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {h.label}
                          {h.sortable && (sortKey === h.key
                            ? (sortAsc ? <ChevronUp style={{ width: 11, height: 11 }} /> : <ChevronDown style={{ width: 11, height: 11 }} />)
                            : <ChevronDown style={{ width: 11, height: 11, opacity: 0.3 }} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(tx => {
                    const nc  = getNC(tx.network);
                    const sc  = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
                    const net = normalizeNetwork(tx.network);
                    return (
                      <tr key={tx.id} className="tx-row" onClick={() => setDetailTx(tx)} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <p style={{ fontWeight: 600, color: "#F4F7F7", marginBottom: 2 }}>{tx.profiles?.full_name || "—"}</p>
                          <p style={{ fontSize: 11, color: "rgba(244,247,247,0.3)" }}>{tx.profiles?.email}</p>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 9px", borderRadius: 7, background: nc.bg, border: `1px solid ${nc.border}`, color: nc.color, fontSize: 11, fontWeight: 800 }}>{net}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", color: "rgba(244,247,247,0.5)", fontSize: 12 }}>
                          {tx.phone_number}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, color: "rgba(244,247,247,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>
                            {tx.type ?? "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#4ade80" }}>
                          ₦{fmt(tx.amount)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 7, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", color: "rgba(244,247,247,0.3)", fontSize: 11, maxWidth: 140 }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.reference}</span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "rgba(244,247,247,0.35)", fontSize: 12, whiteSpace: "nowrap" }}>
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

          {/* Footer + Pagination */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, color: "rgba(244,247,247,0.3)" }}>
                Showing <strong style={{ color: "#53E6D4" }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of <strong style={{ color: "#53E6D4" }}>{filtered.length}</strong> · Click any row for details
              </span>
              {totalPages > 1 && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: page === 1 ? "rgba(244,247,247,0.2)" : "#53E6D4", fontSize: 12, cursor: page === 1 ? "not-allowed" : "pointer", fontWeight: 700 }}>← Prev</button>
                  <span style={{ padding: "5px 12px", fontSize: 12, color: "rgba(244,247,247,0.4)" }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: page === totalPages ? "rgba(244,247,247,0.2)" : "#53E6D4", fontSize: 12, cursor: page === totalPages ? "not-allowed" : "pointer", fontWeight: 700 }}>Next →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}