"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings, Globe, Key, Percent, Bell, Users, Mail,
  Save, Loader2, RefreshCw, Eye, EyeOff, Check,
  AlertTriangle, Plus, Trash2, Send, ChevronRight,
  ToggleLeft, ToggleRight, Copy, ExternalLink, Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppSettings {
  general:       { site_name: string; support_email: string; support_phone: string; logo_url: string; maintenance_mode: boolean };
  active_api:    string;
  gladtidings:   { api_key: string; base_url: string; enabled: boolean };
  clubconnect:   { api_key: string; base_url: string; enabled: boolean };
  commission:    { default_markup: number; airtime_markup: number; data_markup: number; cable_markup: number; electricity_markup: number };
  notifications: { low_balance_threshold: number; low_balance_email: boolean; new_user_email: boolean; failed_tx_alert: boolean; admin_email: string };
  email:         { provider: string; smtp_host: string; smtp_port: number; smtp_user: string; smtp_pass: string; from_name: string; from_email: string };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  updated_at: string;
}

interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

type Tab = "general" | "api" | "commission" | "notifications" | "email" | "admins" | "send_email";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("en-NG", { minimumFractionDigits: 0 }); }

// ─── Section Card ─────────────────────────────────────────────────────────────

function Card({ children, title, icon: Icon, action }: {
  children: React.ReactNode; title: string;
  icon: React.ElementType; action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon style={{ width: 15, height: 15, color: "#53E6D4" }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#F4F7F7" }}>{title}</h2>
        </div>
        {action}
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(244,247,247,0.6)", marginBottom: 6, letterSpacing: ".02em" }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: "rgba(244,247,247,0.3)", marginBottom: 6 }}>{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "", disabled = false }: {
  value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)", color: disabled ? "rgba(244,247,247,0.4)" : "#F4F7F7", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const, transition: "border-color .15s" }}
      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(83,230,212,0.4)"; }}
      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
    />
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!value)}>
      {value
        ? <ToggleRight style={{ width: 28, height: 28, color: "#53E6D4" }} />
        : <ToggleLeft  style={{ width: 28, height: 28, color: "rgba(244,247,247,0.25)" }} />
      }
      {label && <span style={{ fontSize: 13, color: "rgba(244,247,247,0.6)", fontWeight: 600 }}>{label}</span>}
    </div>
  );
}

function SaveBtn({ saving, onClick, label = "Save Changes" }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={saving}
      style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, background: "#53E6D4", border: "none", color: "#0D2E2E", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, marginTop: 8 }}>
      {saving ? <Loader2 style={{ width: 14, height: 14, animation: "spin .8s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
      {saving ? "Saving…" : label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminSettings() {
  const [tab, setTab]             = useState<Tab>("general");
  const [settings, setSettings]   = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [admins, setAdmins]       = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);
  const [showKeys, setShowKeys]   = useState<Record<string, boolean>>({});

  // Send email state
  const [sendTarget, setSendTarget]     = useState<"all" | "single">("all");
  const [sendEmail, setSendEmail]       = useState("");
  const [sendTemplate, setSendTemplate] = useState("");
  const [sendSubject, setSendSubject]   = useState("");
  const [sendBody, setSendBody]         = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);

  // Admin management state
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin]     = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, templatesRes, adminsRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/email-templates"),
        fetch("/api/admin/admins"),
      ]);
      const [s, t, a] = await Promise.all([settingsRes.json(), templatesRes.json(), adminsRes.json()]);
      if (s.settings) setSettings(s.settings);
      if (t.templates) setTemplates(t.templates);
      if (a.admins) setAdmins(a.admins);
    } catch { toast.error("Failed to load settings"); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, []);

  async function saveSetting(key: string, value: any) {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "Failed to save"); return; }
      toast.success("Saved ✓");
      await fetchAll();
    } catch { toast.error("Network error"); }
    finally { setSaving(null); }
  }

  async function sendEmailToUsers() {
    if (!sendSubject.trim() || !sendBody.trim()) { toast.error("Subject and body required"); return; }
    if (sendTarget === "single" && !sendEmail.trim()) { toast.error("Enter an email address"); return; }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: sendTarget, email: sendEmail, subject: sendSubject, body: sendBody }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "Failed to send"); return; }
      toast.success(`Email sent to ${data.count} recipient(s) ✓`);
      setSendSubject(""); setSendBody(""); setSendEmail("");
    } catch { toast.error("Network error"); }
    finally { setSendingEmail(false); }
  }

  async function saveTemplate(tpl: EmailTemplate) {
    setSaving("template_" + tpl.id);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tpl),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "Failed"); return; }
      toast.success("Template saved ✓");
      setEditTemplate(null);
      await fetchAll();
    } catch { toast.error("Network error"); }
    finally { setSaving(null); }
  }

  async function addAdmin() {
    if (!newAdminEmail.trim()) { toast.error("Enter an email"); return; }
    setAddingAdmin(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail, role: "admin" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "Failed"); return; }
      toast.success("Admin added ✓");
      setNewAdminEmail("");
      await fetchAll();
    } catch { toast.error("Network error"); }
    finally { setAddingAdmin(false); }
  }

  async function removeAdmin(userId: string) {
    if (!confirm("Remove this admin?")) return;
    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "Failed"); return; }
      toast.success("Admin removed ✓");
      await fetchAll();
    } catch { toast.error("Network error"); }
  }

  function loadTemplate(name: string) {
    const tpl = templates.find(t => t.name === name);
    if (tpl) {
      setSendSubject(tpl.subject);
      setSendBody(tpl.body.replace(/<[^>]*>/g, '').trim()); // strip HTML for preview
      setSendTemplate(name);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "#F4F7F7", fontFamily: "'Sora', sans-serif" }}>
        <Loader2 style={{ width: 28, height: 28, color: "#53E6D4", margin: "0 auto 12px", animation: "spin .8s linear infinite" }} />
        <p style={{ color: "rgba(244,247,247,0.4)", fontSize: 13 }}>Loading settings…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const s = settings;

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "general",      label: "General",        icon: Globe    },
    { key: "api",          label: "API Providers",  icon: Key      },
    { key: "commission",   label: "Commission",     icon: Percent  },
    { key: "notifications",label: "Notifications",  icon: Bell     },
    { key: "email",        label: "Email Config",   icon: Mail     },
    { key: "send_email",   label: "Send Email",     icon: Send     },
    { key: "admins",       label: "Admins",         icon: Users    },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: rgba(244,247,247,0.2); }
        textarea { resize: vertical; }
      `}</style>

      <div style={{ color: "#F4F7F7", fontFamily: "'Sora', sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-.02em" }}>Settings</h1>
            <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)" }}>Configure your DashSub platform</p>
          </div>
          <button onClick={fetchAll}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "rgba(83,230,212,0.08)", border: "1px solid rgba(83,230,212,0.2)", color: "#53E6D4", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>

          {/* Sidebar tabs */}
          <div style={{ background: "rgba(8,12,12,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 10, position: "sticky", top: 20 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 10, border: "none", background: tab === t.key ? "rgba(83,230,212,0.1)" : "transparent", color: tab === t.key ? "#53E6D4" : "rgba(244,247,247,0.45)", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all .13s" }}>
                <t.icon style={{ width: 15, height: 15 }} />
                {t.label}
                {tab === t.key && <ChevronRight style={{ width: 12, height: 12, marginLeft: "auto" }} />}
              </button>
            ))}
          </div>

          {/* Content */}
          <div>

            {/* ── General ─────────────────────────────────────────────── */}
            {tab === "general" && s && (
              <Card title="General Settings" icon={Globe}>
                <Field label="Site Name">
                  <Input value={s.general.site_name} onChange={v => setSettings({ ...s, general: { ...s.general, site_name: v } })} placeholder="DashSub" />
                </Field>
                <Field label="Support Email">
                  <Input value={s.general.support_email} onChange={v => setSettings({ ...s, general: { ...s.general, support_email: v } })} placeholder="support@dashsub.com" type="email" />
                </Field>
                <Field label="Support Phone">
                  <Input value={s.general.support_phone} onChange={v => setSettings({ ...s, general: { ...s.general, support_phone: v } })} placeholder="+234..." />
                </Field>
                <Field label="Logo URL" hint="Direct link to your logo image">
                  <Input value={s.general.logo_url} onChange={v => setSettings({ ...s, general: { ...s.general, logo_url: v } })} placeholder="https://..." />
                </Field>
                <Field label="Maintenance Mode" hint="When enabled, users cannot access the platform">
                  <Toggle value={s.general.maintenance_mode} onChange={v => setSettings({ ...s, general: { ...s.general, maintenance_mode: v } })} label={s.general.maintenance_mode ? "Maintenance mode ON — users blocked" : "Platform is live"} />
                </Field>
                <SaveBtn saving={saving === "general"} onClick={() => saveSetting("general", s.general)} />
              </Card>
            )}

            {/* ── API Providers ────────────────────────────────────────── */}
            {tab === "api" && s && (
              <>
                {/* Active provider selector */}
                <Card title="Active API Provider" icon={Zap}
                  action={
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(74,222,128,0.2)" }}>
                      Current: {s.active_api === "gladtidings" ? "GladTidings" : "ClubConnect"}
                    </span>
                  }
                >
                  <p style={{ fontSize: 13, color: "rgba(244,247,247,0.5)", marginBottom: 18 }}>
                    Select which API provider processes your VTU transactions. Switch instantly — new transactions will use the selected provider.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {[
                      { key: "gladtidings", label: "GladTidings", url: "gladtidingsdata.com", color: "#FACC15" },
                      { key: "clubconnect",  label: "ClubConnect",  url: "clubconnect.ng",     color: "#53E6D4" },
                    ].map(p => (
                      <div key={p.key} onClick={() => setSettings({ ...s, active_api: p.key })}
                        style={{ padding: "16px 18px", borderRadius: 14, border: `2px solid ${s.active_api === p.key ? p.color : "rgba(255,255,255,0.08)"}`, background: s.active_api === p.key ? `${p.color}0D` : "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all .15s" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: s.active_api === p.key ? p.color : "#F4F7F7" }}>{p.label}</span>
                          {s.active_api === p.key && <Check style={{ width: 16, height: 16, color: p.color }} />}
                        </div>
                        <p style={{ fontSize: 11, color: "rgba(244,247,247,0.35)" }}>{p.url}</p>
                      </div>
                    ))}
                  </div>
                  <SaveBtn saving={saving === "active_api"} onClick={() => saveSetting("active_api", s.active_api)} label="Switch Provider" />
                </Card>

                {/* GladTidings config */}
                <Card title="GladTidings Configuration" icon={Key}>
                  <Field label="API Key">
                    <div style={{ position: "relative" }}>
                      <Input type={showKeys.glad ? "text" : "password"} value={s.gladtidings.api_key} onChange={v => setSettings({ ...s, gladtidings: { ...s.gladtidings, api_key: v } })} placeholder="Enter your GladTidings API key" />
                      <button onClick={() => setShowKeys(k => ({ ...k, glad: !k.glad }))} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(244,247,247,0.4)", cursor: "pointer" }}>
                        {showKeys.glad ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Base URL">
                    <Input value={s.gladtidings.base_url} onChange={v => setSettings({ ...s, gladtidings: { ...s.gladtidings, base_url: v } })} placeholder="https://gladtidingsdata.com/api" />
                  </Field>
                  <Field label="Enabled">
                    <Toggle value={s.gladtidings.enabled} onChange={v => setSettings({ ...s, gladtidings: { ...s.gladtidings, enabled: v } })} label={s.gladtidings.enabled ? "Active" : "Disabled"} />
                  </Field>
                  <SaveBtn saving={saving === "gladtidings"} onClick={() => saveSetting("gladtidings", s.gladtidings)} />
                </Card>

                {/* ClubConnect config */}
                <Card title="ClubConnect Configuration" icon={Key}>
                  <Field label="API Key">
                    <div style={{ position: "relative" }}>
                      <Input type={showKeys.club ? "text" : "password"} value={s.clubconnect.api_key} onChange={v => setSettings({ ...s, clubconnect: { ...s.clubconnect, api_key: v } })} placeholder="Enter your ClubConnect API key" />
                      <button onClick={() => setShowKeys(k => ({ ...k, club: !k.club }))} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(244,247,247,0.4)", cursor: "pointer" }}>
                        {showKeys.club ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Base URL">
                    <Input value={s.clubconnect.base_url} onChange={v => setSettings({ ...s, clubconnect: { ...s.clubconnect, base_url: v } })} placeholder="https://api.clubconnect.ng" />
                  </Field>
                  <Field label="Enabled">
                    <Toggle value={s.clubconnect.enabled} onChange={v => setSettings({ ...s, clubconnect: { ...s.clubconnect, enabled: v } })} label={s.clubconnect.enabled ? "Active" : "Disabled"} />
                  </Field>
                  <SaveBtn saving={saving === "clubconnect"} onClick={() => saveSetting("clubconnect", s.clubconnect)} />
                </Card>
              </>
            )}

            {/* ── Commission ───────────────────────────────────────────── */}
            {tab === "commission" && s && (
              <Card title="Commission & Markup Rules" icon={Percent}>
                <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)", marginBottom: 22, lineHeight: 1.7 }}>
                  Set the markup percentage added on top of cost price for each service type. These apply globally unless overridden per plan.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { key: "default_markup",     label: "Default Markup (%)",     hint: "Fallback for all services" },
                    { key: "data_markup",         label: "Data Plans (%)",         hint: "Applied to all data purchases" },
                    { key: "airtime_markup",      label: "Airtime (%)",            hint: "Applied to airtime top-ups" },
                    { key: "cable_markup",        label: "Cable TV (%)",           hint: "Applied to cable subscriptions" },
                    { key: "electricity_markup",  label: "Electricity (%)",        hint: "Applied to electricity tokens" },
                  ].map(f => (
                    <Field key={f.key} label={f.label} hint={f.hint}>
                      <div style={{ position: "relative" }}>
                        <Input type="number" value={(s.commission as any)[f.key]} onChange={v => setSettings({ ...s, commission: { ...s.commission, [f.key]: parseFloat(v) || 0 } })} />
                        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#53E6D4", fontWeight: 700 }}>%</span>
                      </div>
                    </Field>
                  ))}
                </div>

                {/* Visual preview */}
                <div style={{ background: "rgba(83,230,212,0.05)", border: "1px solid rgba(83,230,212,0.1)", borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,247,247,0.4)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>Preview Example</p>
                  <p style={{ fontSize: 13, color: "rgba(244,247,247,0.6)" }}>
                    Cost price ₦100 → Selling price <strong style={{ color: "#53E6D4" }}>₦{(100 * (1 + s.commission.data_markup / 100)).toFixed(0)}</strong> at {s.commission.data_markup}% data markup
                  </p>
                </div>

                <SaveBtn saving={saving === "commission"} onClick={() => saveSetting("commission", s.commission)} />
              </Card>
            )}

            {/* ── Notifications ────────────────────────────────────────── */}
            {tab === "notifications" && s && (
              <Card title="Notification Settings" icon={Bell}>
                <Field label="Admin Notification Email" hint="Where admin alerts are sent">
                  <Input value={s.notifications.admin_email} onChange={v => setSettings({ ...s, notifications: { ...s.notifications, admin_email: v } })} placeholder="admin@dashsub.com" type="email" />
                </Field>
                <Field label="Low Balance Threshold (₦)" hint="Alert when user wallet drops below this amount">
                  <Input type="number" value={s.notifications.low_balance_threshold} onChange={v => setSettings({ ...s, notifications: { ...s.notifications, low_balance_threshold: parseInt(v) || 0 } })} />
                </Field>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8, marginBottom: 16 }}>
                  {[
                    { key: "low_balance_email", label: "Email users when balance is low" },
                    { key: "new_user_email",    label: "Send welcome email to new users" },
                    { key: "failed_tx_alert",   label: "Alert admin on failed transactions" },
                  ].map(f => (
                    <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: 13, color: "rgba(244,247,247,0.7)", fontWeight: 600 }}>{f.label}</span>
                      <Toggle value={(s.notifications as any)[f.key]} onChange={v => setSettings({ ...s, notifications: { ...s.notifications, [f.key]: v } })} />
                    </div>
                  ))}
                </div>
                <SaveBtn saving={saving === "notifications"} onClick={() => saveSetting("notifications", s.notifications)} />
              </Card>
            )}

            {/* ── Email Config ─────────────────────────────────────────── */}
            {tab === "email" && s && (
              <>
                <Card title="SMTP Configuration" icon={Mail}>
                  <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)", marginBottom: 18 }}>Configure your SMTP server to send emails to users.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <Field label="SMTP Host">
                      <Input value={s.email.smtp_host} onChange={v => setSettings({ ...s, email: { ...s.email, smtp_host: v } })} placeholder="smtp.gmail.com" />
                    </Field>
                    <Field label="SMTP Port">
                      <Input type="number" value={s.email.smtp_port} onChange={v => setSettings({ ...s, email: { ...s.email, smtp_port: parseInt(v) || 587 } })} placeholder="587" />
                    </Field>
                    <Field label="SMTP Username">
                      <Input value={s.email.smtp_user} onChange={v => setSettings({ ...s, email: { ...s.email, smtp_user: v } })} placeholder="your@email.com" />
                    </Field>
                    <Field label="SMTP Password">
                      <div style={{ position: "relative" }}>
                        <Input type={showKeys.smtp ? "text" : "password"} value={s.email.smtp_pass} onChange={v => setSettings({ ...s, email: { ...s.email, smtp_pass: v } })} placeholder="App password" />
                        <button onClick={() => setShowKeys(k => ({ ...k, smtp: !k.smtp }))} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(244,247,247,0.4)", cursor: "pointer" }}>
                          {showKeys.smtp ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </Field>
                    <Field label="From Name">
                      <Input value={s.email.from_name} onChange={v => setSettings({ ...s, email: { ...s.email, from_name: v } })} placeholder="DashSub" />
                    </Field>
                    <Field label="From Email">
                      <Input value={s.email.from_email} onChange={v => setSettings({ ...s, email: { ...s.email, from_email: v } })} placeholder="noreply@dashsub.com" type="email" />
                    </Field>
                  </div>
                  <SaveBtn saving={saving === "email"} onClick={() => saveSetting("email", s.email)} />
                </Card>

                {/* Email Templates */}
                <Card title="Email Templates" icon={Mail}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {templates.map(tpl => (
                      <div key={tpl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${editTemplate?.id === tpl.id ? "rgba(83,230,212,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#F4F7F7", marginBottom: 3, textTransform: "capitalize" }}>{tpl.name.replace(/_/g, " ")}</p>
                          <p style={{ fontSize: 11, color: "rgba(244,247,247,0.35)" }}>{tpl.subject}</p>
                        </div>
                        <button onClick={() => setEditTemplate(editTemplate?.id === tpl.id ? null : { ...tpl })}
                          style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(83,230,212,0.08)", border: "1px solid rgba(83,230,212,0.15)", color: "#53E6D4", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          {editTemplate?.id === tpl.id ? "Cancel" : "Edit"}
                        </button>
                      </div>
                    ))}
                  </div>

                  {editTemplate && (
                    <div style={{ marginTop: 20, padding: 18, borderRadius: 14, background: "rgba(83,230,212,0.04)", border: "1px solid rgba(83,230,212,0.15)" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#53E6D4", marginBottom: 14, textTransform: "uppercase", letterSpacing: ".1em" }}>
                        Editing: {editTemplate.name.replace(/_/g, " ")}
                      </p>
                      {editTemplate.variables?.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                          {editTemplate.variables.map((v: string) => (
                            <span key={v} style={{ fontSize: 11, background: "rgba(83,230,212,0.1)", color: "#53E6D4", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(83,230,212,0.2)", fontFamily: "'IBM Plex Mono', monospace" }}>
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      )}
                      <Field label="Subject">
                        <Input value={editTemplate.subject} onChange={v => setEditTemplate({ ...editTemplate, subject: v })} />
                      </Field>
                      <Field label="Body (HTML supported)">
                        <textarea value={editTemplate.body} onChange={e => setEditTemplate({ ...editTemplate, body: e.target.value })}
                          rows={8} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#F4F7F7", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box" as const }} />
                      </Field>
                      <SaveBtn saving={saving === `template_${editTemplate.id}`} onClick={() => saveTemplate(editTemplate)} label="Save Template" />
                    </div>
                  )}
                </Card>
              </>
            )}

            {/* ── Send Email ───────────────────────────────────────────── */}
            {tab === "send_email" && (
              <Card title="Send Email to Users" icon={Send}>
                <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)", marginBottom: 20 }}>
                  Send a message directly to all users or a specific user.
                </p>

                {/* Target */}
                <Field label="Recipient">
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    {(["all", "single"] as const).map(t => (
                      <button key={t} onClick={() => setSendTarget(t)}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${sendTarget === t ? "rgba(83,230,212,0.4)" : "rgba(255,255,255,0.08)"}`, background: sendTarget === t ? "rgba(83,230,212,0.08)" : "transparent", color: sendTarget === t ? "#53E6D4" : "rgba(244,247,247,0.4)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {t === "all" ? "All Users" : "Specific User"}
                      </button>
                    ))}
                  </div>
                  {sendTarget === "single" && (
                    <Input value={sendEmail} onChange={setSendEmail} placeholder="user@email.com" type="email" />
                  )}
                </Field>

                {/* Template picker */}
                <Field label="Load from Template (optional)">
                  <select value={sendTemplate} onChange={e => loadTemplate(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#F4F7F7", fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                    <option value="">— Choose a template —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.name} style={{ background: "#0D1F1F" }}>
                        {t.name.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Subject">
                  <Input value={sendSubject} onChange={setSendSubject} placeholder="Your message subject" />
                </Field>

                <Field label="Message Body" hint="You can use HTML. Use {{full_name}} to personalize.">
                  <textarea value={sendBody} onChange={e => setSendBody(e.target.value)} rows={8} placeholder="Write your message here…"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#F4F7F7", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                </Field>

                {/* Warning for all users */}
                {sendTarget === "all" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.15)", marginBottom: 14 }}>
                    <AlertTriangle style={{ width: 15, height: 15, color: "#facc15", flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: "rgba(244,247,247,0.5)" }}>This will send to ALL registered users. Make sure your SMTP is configured.</p>
                  </div>
                )}

                <button onClick={sendEmailToUsers} disabled={sendingEmail}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 12, background: "#53E6D4", border: "none", color: "#0D2E2E", fontSize: 13, fontWeight: 800, cursor: sendingEmail ? "not-allowed" : "pointer", opacity: sendingEmail ? 0.7 : 1 }}>
                  {sendingEmail ? <Loader2 style={{ width: 14, height: 14, animation: "spin .8s linear infinite" }} /> : <Send style={{ width: 14, height: 14 }} />}
                  {sendingEmail ? "Sending…" : sendTarget === "all" ? "Send to All Users" : "Send Email"}
                </button>
              </Card>
            )}

            {/* ── Admins ───────────────────────────────────────────────── */}
            {tab === "admins" && (
              <Card title="Admin Management" icon={Users}>
                <p style={{ fontSize: 13, color: "rgba(244,247,247,0.4)", marginBottom: 20 }}>
                  Add or remove admin users. Admins have full access to this panel.
                </p>

                {/* Add admin */}
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  <div style={{ flex: 1 }}>
                    <Input value={newAdminEmail} onChange={setNewAdminEmail} placeholder="Enter user email to add as admin" type="email" />
                  </div>
                  <button onClick={addAdmin} disabled={addingAdmin}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: "#53E6D4", border: "none", color: "#0D2E2E", fontSize: 13, fontWeight: 800, cursor: addingAdmin ? "not-allowed" : "pointer", opacity: addingAdmin ? 0.7 : 1, whiteSpace: "nowrap" }}>
                    {addingAdmin ? <Loader2 style={{ width: 13, height: 13, animation: "spin .8s linear infinite" }} /> : <Plus style={{ width: 13, height: 13 }} />}
                    Add Admin
                  </button>
                </div>

                {/* Admin list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {admins.length === 0 ? (
                    <p style={{ fontSize: 13, color: "rgba(244,247,247,0.3)", textAlign: "center", padding: "30px 0" }}>No admins found</p>
                  ) : admins.map(admin => (
                    <div key={admin.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(83,230,212,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#53E6D4" }}>
                          {(admin.full_name || admin.email || "A")[0].toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#F4F7F7", marginBottom: 2 }}>{admin.full_name || admin.email || "Unknown"}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "rgba(244,247,247,0.35)" }}>{admin.email}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, background: admin.role === "super_admin" ? "rgba(250,204,21,0.12)" : "rgba(83,230,212,0.1)", color: admin.role === "super_admin" ? "#facc15" : "#53E6D4", padding: "2px 7px", borderRadius: 5 }}>
                              {admin.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      {admin.role !== "super_admin" && (
                        <button onClick={() => removeAdmin(admin.user_id)}
                          style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}