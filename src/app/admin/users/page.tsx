"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Search, RefreshCw, Users, Wallet, ShieldOff, ShieldCheck,
  ChevronDown, ChevronUp, X, Loader2, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, DollarSign,
  TrendingUp, Ban, UserCheck, Eye, Plus, Minus,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  wallet_balance: number;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  phone?: string;
  _tx_count?: number;
  _total_spent?: number;
}

interface Transaction {
  id: string;
  network: string;
  plan_name: string;
  amount: number;
  phone: string;
  status: "success" | "failed" | "pending";
  created_at: string;
}

type SortKey = "created_at" | "wallet_balance" | "full_name" | "_total_spent";
type FilterKey = "all" | "active" | "banned" | "low_balance" | "high_value";

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  MTN:       { color: "#FACC15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)" },
  GLO:       { color: "#22C55E", bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.25)"  },
  AIRTEL:    { color: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)"  },
  "9MOBILE": { color: "#53E6D4", bg: "rgba(83,230,212,0.10)",  border: "rgba(83,230,212,0.25)" },
};

const STATUS_CONFIG = {
  success: { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  label: "Success" },
  failed:  { color: "#f87171", bg: "rgba(248,113,113,0.12)", label: "Failed"  },
  pending: { color: "#facc15", bg: "rgba(250,204,21,0.12)",  label: "Pending" },
};

const LOW_BALANCE_THRESHOLD = 500;
const HIGH_VALUE_THRESHOLD  = 10000;

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
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(" ");
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

const AVATAR_COLORS = [
  "rgba(83,230,212,0.2)",  "rgba(250,204,21,0.2)",
  "rgba(74,222,128,0.2)",  "rgba(167,139,250,0.2)",
  "rgba(251,146,60,0.2)",
];
function avatarColor(id: string) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}
function avatarTextColor(id: string) {
  const colors = ["#53E6D4","#FACC15","#4ade80","#a78bfa","#fb923c"];
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[hash];
}

// ─── Top-up Modal ─────────────────────────────────────────────────────────────

function TopUpModal({
  user, onClose, onDone,
}: { user: UserProfile; onClose: () => void; onDone: (newBal: number) => void }) {
  const [amount, setAmount]   = useState("");
  const [type, setType]       = useState<"credit" | "debit">("credit");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);

  const PRESETS = [100, 200, 500, 1000, 2000, 5000];

  async function handleSubmit() {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid amount"); return; }
    if (type === "debit" && val > user.wallet_balance) { toast.error("Amount exceeds balance"); return; }

    setSaving(true);
    const newBalance = type === "credit"
      ? user.wallet_balance + val
      : user.wallet_balance - val;

    try {
      const res = await fetch("/api/admin/update-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, amount: val, type, reason, new_balance: newBalance }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "Failed"); return; }
      toast.success(`₦${fmt(val)} ${type === "credit" ? "credited" : "debited"} ✓`);
      onDone(newBalance);
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0D1F1F", border: "1px solid rgba(83,230,212,0.15)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#F4F7F7" }}>Adjust Wallet</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(244,247,247,0.4)", cursor: "pointer" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* User info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(83,230,212,0.05)", border: "1px solid rgba(83,230,212,0.1)", marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor(user.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: avatarTextColor(user.id) }}>
            {initials(user.full_name, user.email)}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#F4F7F7" }}>{user.full_name || user.email}</p>
            <p style={{ fontSize: 11, color: "rgba(244,247,247,0.4)" }}>Balance: <span style={{ color: "#53E6D4", fontFamily: "'IBM Plex Mono', monospace" }}>₦{fmt(user.wallet_balance)}</span></p>
          </div>
        </div>

        {/* Credit / Debit toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["credit", "debit"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${type === t ? (t === "credit" ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)") : "rgba(255,255,255,0.08)"}`, background: type === t ? (t === "credit" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)") : "transparent", color: type === t ? (t === "credit" ? "#4ade80" : "#f87171") : "rgba(244,247,247,0.35)", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {t === "credit" ? <Plus style={{ width: 13, height: 13 }} /> : <Minus style={{ width: 13, height: 13 }} />}
              {t === "credit" ? "Top Up" : "Deduct"}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {PRESETS.map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${amount === String(p) ? "rgba(83,230,212,0.4)" : "rgba(255,255,255,0.08)"}`, background: amount === String(p) ? "rgba(83,230,212,0.1)" : "transparent", color: amount === String(p) ? "#53E6D4" : "rgba(244,247,247,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              ₦{fmt(p)}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <input
          type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Custom amount (₦)"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(83,230,212,0.2)", background: "rgba(83,230,212,0.04)", color: "#F4F7F7", fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 12, boxSizing: "border-box", outline: "none" }}
        />

        {/* Reason */}
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#F4F7F7", fontSize: 13, marginBottom: 18, boxSizing: "border-box", outline: "none" }}
        />

        <button onClick={handleSubmit} disabled={saving}
          style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: type === "credit" ? "#4ade80" : "#f87171", border: "none", color: type === "credit" ? "#0a1a0a" : "#1a0a0a", fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {saving ? <Loader2 style={{ width: 15, height: 15, animation: "spin .8s linear infinite" }} /> : null}
          {saving ? "Processing…" : `Confirm ${type === "credit" ? "Top Up" : "Deduction"}`}
        </button>
      </div>
    </div>
  );
}

// ─── Ban Modal ────────────────────────────────────────────────────────────────

function BanModal({
  user, onClose, onDone,
}: { user: UserProfile; onClose: () => void; onDone: (banned: boolean) => void }) {
  const [reason, setReason] = useState(user.ban_reason ?? "");
  const [saving, setSaving] = useState(false);
  const isBanned = user.is_banned;

  async function handleSubmit() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ban-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, ban: !isBanned, reason }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "Failed"); return; }
      toast.success(isBanned ? "User unbanned ✓" : "User banned ✓");
      onDone(!isBanned);
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0D1F1F", border: `1px solid ${isBanned ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, borderRadius: 20, padding: 28, width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#F4F7F7" }}>
            {isBanned ? "Unban User" : "Ban User"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(244,247,247,0.4)", cursor: "pointer" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: "rgba(244,247,247,0.5)", marginBottom: 18, lineHeight: 1.6 }}>
          {isBanned
            ? `This will restore access for ${user.full_name || user.email}.`
            : `This will prevent ${user.full_name || user.email} from logging in or making transactions.`}
        </p>

        {!isBanned && (
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Ban reason (optional)"
            rows={3}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#F4F7F7", fontSize: 13, marginBottom: 18, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit" }}
          />
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(244,247,247,0.5)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: isBanned ? "#4ade80" : "#f87171", border: "none", color: isBanned ? "#0a1a0a" : "#1a0a0a", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {saving ? <Loader2 style={{ width: 13, height: 13, animation: "spin .8s linear infinite" }} /> : null}
            {saving ? "Processing…" : isBanned ? "Unban" : "Ban User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tx History Drawer ────────────────────────────────────────────────────────

function TxDrawer({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const [txs, setTxs]       = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { setTxs(data || []); setLoading(false); });
  }, [user.id]);

  const totalSpent = txs.filter(t => t.status === "success").reduce((s, t) => s + t.amount, 0);
  const successCount = txs.filter(t => t.status === "success").length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: "100%", maxWidth: 480, height: "100%", background: "#0D1F1F", borderLeft: "1px solid rgba(83,230,212,0.12)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: avatarColor(user.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: avatarTextColor(user.id) }}>
            {initials(user.full_name, user.email)}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#F4F7F7" }}>{user.full_name || "Unnamed"}</p>
            <p style={{ fontSize: 11, color: "rgba(244,247,247,0.35)" }}>{user.email}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: "rgba(244,247,247,0.5)" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {[
            { label: "Total Spent",  value: `₦${fmt(totalSpent)}`,  color: "#4ade80" },
            { label: "Transactions", value: txs.length,             color: "#53E6D4" },
            { label: "Success",      value: `${successCount}`,      color: "#FACC15" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(244,247,247,0.35)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 5 }}>{s.label}</p>
              <p style={{ fontSize: 15, fontWeight: 900, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Transaction list */}
        <div style={{ flex: 1, padding: "16px 24px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>
            Last {txs.length} Transactions
          </p>

          {loading ? (
            <div style={{ textAlign: "center", paddingTop: 40 }}>
              <Loader2 style={{ width: 22, height: 22, color: "#53E6D4", margin: "0 auto", animation: "spin .8s linear infinite" }} />
            </div>
          ) : txs.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 40 }}>
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13 }}>No transactions yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {txs.map(tx => {
                const nc = NETWORK_COLORS[tx.network] ?? NETWORK_COLORS["9MOBILE"];
                const sc = STATUS_CONFIG[tx.status]   ?? STATUS_CONFIG.pending;
                return (
                  <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, background: nc.bg, border: `1px solid ${nc.border}`, color: nc.color, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                      {tx.network}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#F4F7F7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.plan_name}</p>
                      <p style={{ fontSize: 10, color: "rgba(244,247,247,0.3)", marginTop: 2 }}>{tx.phone} · {timeAgo(tx.created_at)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#4ade80", fontFamily: "'IBM Plex Mono', monospace" }}>₦{fmt(tx.amount)}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: sc.color }}>{sc.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<FilterKey>("all");
  const [sortKey, setSortKey]   = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc]   = useState(false);
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 20;

  const [topUpUser, setTopUpUser]   = useState<UserProfile | null>(null);
  const [banUser, setBanUser]       = useState<UserProfile | null>(null);
  const [txUser, setTxUser]         = useState<UserProfile | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);

    // Fetch profiles
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { toast.error("Failed to load users"); setLoading(false); return; }

    // Fetch transaction summaries per user
    const { data: txSummary } = await supabase
      .from("transactions")
      .select("user_id, amount, status");

    const txMap: Record<string, { count: number; spent: number }> = {};
    (txSummary || []).forEach(t => {
      if (!txMap[t.user_id]) txMap[t.user_id] = { count: 0, spent: 0 };
      txMap[t.user_id].count++;
      if (t.status === "success") txMap[t.user_id].spent += t.amount;
    });

    const enriched = (profiles || []).map(p => ({
      ...p,
      _tx_count:    txMap[p.id]?.count ?? 0,
      _total_spent: txMap[p.id]?.spent ?? 0,
    }));

    setUsers(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    setupRealtime();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  function setupRealtime() {
    channelRef.current = supabase
      .channel("admin-users-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => fetchUsers())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        setUsers(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
      })
      .subscribe();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = users.length;
    const banned   = users.filter(u => u.is_banned).length;
    const lowBal   = users.filter(u => u.wallet_balance < LOW_BALANCE_THRESHOLD).length;
    const highVal  = users.filter(u => (u._total_spent ?? 0) >= HIGH_VALUE_THRESHOLD).length;
    const today    = new Date(); today.setHours(0,0,0,0);
    const newToday = users.filter(u => new Date(u.created_at) >= today).length;
    return { total, banned, lowBal, highVal, newToday };
  }, [users]);

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...users];

    // Filter
    if (filter === "active")      list = list.filter(u => !u.is_banned);
    if (filter === "banned")      list = list.filter(u => u.is_banned);
    if (filter === "low_balance") list = list.filter(u => u.wallet_balance < LOW_BALANCE_THRESHOLD);
    if (filter === "high_value")  list = list.filter(u => (u._total_spent ?? 0) >= HIGH_VALUE_THRESHOLD);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let av: number | string = a[sortKey as keyof UserProfile] as any ?? 0;
      let bv: number | string = b[sortKey as keyof UserProfile] as any ?? 0;
      if (sortKey === "full_name") {
        av = (a.full_name ?? a.email ?? "").toLowerCase();
        bv = (b.full_name ?? b.email ?? "").toLowerCase();
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [users, filter, search, sortKey, sortAsc]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown style={{ width: 11, height: 11, opacity: 0.3 }} />;
    return sortAsc
      ? <ChevronUp   style={{ width: 11, height: 11, color: "#53E6D4" }} />
      : <ChevronDown style={{ width: 11, height: 11, color: "#53E6D4" }} />;
  }

  const FILTERS: { key: FilterKey; label: string; count: number }[] = [
    { key: "all",         label: "All",         count: stats.total    },
    { key: "active",      label: "Active",      count: stats.total - stats.banned },
    { key: "banned",      label: "Banned",      count: stats.banned   },
    { key: "low_balance", label: "Low Balance", count: stats.lowBal   },
    { key: "high_value",  label: "High Value",  count: stats.highVal  },
  ];

  return (
    <>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
        .u-row { transition: background .12s; animation: fadeIn .2s ease; }
        .u-row:hover { background: rgba(83,230,212,0.025) !important; }
        .act-btn { transition: all .13s; }
        .act-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.15); }
        .filt-chip { transition: all .13s; cursor: pointer; }
        .filt-chip:hover { transform: translateY(-1px); }
        input::placeholder { color: rgba(244,247,247,0.25); }
        textarea::placeholder { color: rgba(244,247,247,0.25); }
      `}</style>

      {/* Modals */}
      {topUpUser && (
        <TopUpModal user={topUpUser} onClose={() => setTopUpUser(null)}
          onDone={(newBal) => {
            setUsers(prev => prev.map(u => u.id === topUpUser.id ? { ...u, wallet_balance: newBal } : u));
            setTopUpUser(null);
          }}
        />
      )}
      {banUser && (
        <BanModal user={banUser} onClose={() => setBanUser(null)}
          onDone={(banned) => {
            setUsers(prev => prev.map(u => u.id === banUser.id ? { ...u, is_banned: banned, banned_at: banned ? new Date().toISOString() : null } : u));
            setBanUser(null);
          }}
        />
      )}
      {txUser && <TxDrawer user={txUser} onClose={() => setTxUser(null)} />}

      <div style={{ color: "#F4F7F7", fontFamily: "'Sora', sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-.02em" }}>Users</h1>
            <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)" }}>
              {stats.total} total · {stats.newToday} joined today
            </p>
          </div>
          <button onClick={fetchUsers} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "rgba(83,230,212,0.08)", border: "1px solid rgba(83,230,212,0.2)", color: "#53E6D4", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? "spin .8s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {/* Stat chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Total Users",   value: stats.total,               color: "#53E6D4", icon: Users        },
            { label: "Active",        value: stats.total - stats.banned, color: "#4ade80", icon: UserCheck    },
            { label: "Banned",        value: stats.banned,              color: "#f87171", icon: Ban          },
            { label: "Low Balance",   value: stats.lowBal,              color: "#facc15", icon: AlertTriangle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: "rgba(13,46,46,0.6)", border: "1px solid rgba(83,230,212,0.08)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.35)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</p>
              </div>
              <Icon style={{ width: 18, height: 18, color, opacity: 0.6 }} />
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

            {/* Filter chips */}
            {FILTERS.map(f => (
              <button key={f.key} className="filt-chip"
                onClick={() => { setFilter(f.key); setPage(1); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${filter === f.key ? "rgba(83,230,212,0.35)" : "rgba(255,255,255,0.07)"}`, background: filter === f.key ? "rgba(83,230,212,0.1)" : "transparent", color: filter === f.key ? "#53E6D4" : "rgba(244,247,247,0.4)", fontSize: 12, fontWeight: 700 }}>
                {f.label}
                <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 6, fontWeight: 800 }}>{f.count}</span>
              </button>
            ))}

            {/* Search */}
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "rgba(244,247,247,0.25)" }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, email, phone…"
                style={{ paddingLeft: 32, paddingRight: 14, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#F4F7F7", fontSize: 12, outline: "none", width: 240, fontFamily: "inherit" }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <Loader2 style={{ width: 26, height: 26, color: "#53E6D4", margin: "0 auto 10px", animation: "spin .8s linear infinite" }} />
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13 }}>Loading users…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <Users style={{ width: 26, height: 26, color: "rgba(244,247,247,0.15)", margin: "0 auto 10px" }} />
              <p style={{ color: "rgba(244,247,247,0.3)", fontSize: 13 }}>No users found</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em" }}>User</th>
                    {[
                      { label: "Balance",   key: "wallet_balance" as SortKey },
                      { label: "Spent",     key: "_total_spent"   as SortKey },
                      { label: "Joined",    key: "created_at"     as SortKey },
                    ].map(h => (
                      <th key={h.key} onClick={() => toggleSort(h.key)}
                        style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: sortKey === h.key ? "#53E6D4" : "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {h.label} <SortIcon k={h.key} />
                        </span>
                      </th>
                    ))}
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Tx</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(244,247,247,0.3)", textTransform: "uppercase", letterSpacing: ".1em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(user => (
                    <tr key={user.id} className="u-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>

                      {/* User */}
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarColor(user.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: avatarTextColor(user.id), flexShrink: 0 }}>
                            {initials(user.full_name, user.email)}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: "#F4F7F7", marginBottom: 2 }}>{user.full_name || "—"}</p>
                            <p style={{ fontSize: 11, color: "rgba(244,247,247,0.35)" }}>{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Balance */}
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13, color: user.wallet_balance < LOW_BALANCE_THRESHOLD ? "#f87171" : "#4ade80" }}>
                          ₦{fmt(user.wallet_balance)}
                        </span>
                      </td>

                      {/* Total spent */}
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "rgba(244,247,247,0.55)" }}>
                          ₦{fmt(user._total_spent ?? 0)}
                        </span>
                      </td>

                      {/* Joined */}
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(244,247,247,0.35)", fontSize: 12 }}>
                          <Clock style={{ width: 11, height: 11 }} />
                          {timeAgo(user.created_at)}
                        </div>
                      </td>

                      {/* Tx count */}
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ fontSize: 13, color: "rgba(244,247,247,0.5)", fontFamily: "'IBM Plex Mono', monospace" }}>
                          {user._tx_count ?? 0}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: "13px 16px" }}>
                        {user.is_banned ? (
                          <span style={{ padding: "3px 10px", borderRadius: 7, background: "rgba(248,113,113,0.12)", color: "#f87171", fontSize: 11, fontWeight: 700 }}>Banned</span>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: 7, background: "rgba(74,222,128,0.10)", color: "#4ade80", fontSize: 11, fontWeight: 700 }}>Active</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {/* View Tx */}
                          <button className="act-btn" onClick={() => setTxUser(user)}
                            title="View transactions"
                            style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(83,230,212,0.08)", border: "1px solid rgba(83,230,212,0.15)", color: "#53E6D4", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700 }}>
                            <Eye style={{ width: 12, height: 12 }} />
                            Tx
                          </button>

                          {/* Top up */}
                          <button className="act-btn" onClick={() => setTopUpUser(user)}
                            title="Adjust wallet"
                            style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700 }}>
                            <Wallet style={{ width: 12, height: 12 }} />
                            ₦
                          </button>

                          {/* Ban toggle */}
                          <button className="act-btn" onClick={() => setBanUser(user)}
                            title={user.is_banned ? "Unban user" : "Ban user"}
                            style={{ padding: "6px 10px", borderRadius: 8, background: user.is_banned ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${user.is_banned ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`, color: user.is_banned ? "#4ade80" : "#f87171", cursor: "pointer", display: "flex", alignItems: "center" }}>
                            {user.is_banned
                              ? <ShieldCheck style={{ width: 13, height: 13 }} />
                              : <ShieldOff   style={{ width: 13, height: 13 }} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination + footer */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, color: "rgba(244,247,247,0.3)" }}>
                Showing <strong style={{ color: "#53E6D4" }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of <strong style={{ color: "#53E6D4" }}>{filtered.length}</strong> users
              </span>
              {totalPages > 1 && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: page === 1 ? "rgba(244,247,247,0.2)" : "#53E6D4", fontSize: 12, cursor: page === 1 ? "not-allowed" : "pointer", fontWeight: 700 }}>
                    ← Prev
                  </button>
                  <span style={{ padding: "5px 12px", fontSize: 12, color: "rgba(244,247,247,0.4)" }}>
                    {page} / {totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: page === totalPages ? "rgba(244,247,247,0.2)" : "#53E6D4", fontSize: 12, cursor: page === totalPages ? "not-allowed" : "pointer", fontWeight: 700 }}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}