'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings, Globe, Palette, Mail, CreditCard,
  Zap, Shield, Save, Loader2, RefreshCw, Eye,
  EyeOff, Check, AlertTriangle, ChevronRight,
  ToggleLeft, ToggleRight, Copy, ExternalLink,
  Server, Percent, Clock, Users, Bell,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──
interface GeneralSettings {
  site_name: string; tagline: string; support_email: string;
  support_phone: string; maintenance_mode: boolean; maintenance_message: string;
}
interface LandingSettings {
  hero_title: string; hero_subtitle: string; hero_cta_text: string;
  hero_cta_link: string; show_stats: boolean; primary_color: string;
  accent_color: string; show_features: boolean;
  stats: { users: string; transactions: string; networks: string };
}
interface EmailSettings {
  from_name: string; from_email: string; welcome_subject: string;
  welcome_body: string; transaction_subject: string; transaction_body: string;
  support_footer: string;
}
interface PaymentSettings {
  monnify_api_key: string; monnify_secret_key: string;
  monnify_contract_code: string; monnify_base_url: string;
  webhook_secret: string; min_deposit: number; max_deposit: number;
}
interface ApiSettings {
  gladtidings_token: string; gladtidings_base_url: string;
  global_markup_percent: number; auto_sync_enabled: boolean; auto_sync_hour: number;
}
interface SecuritySettings {
  session_timeout_hours: number; max_login_attempts: number;
  require_2fa: boolean; allow_new_registrations: boolean; ip_whitelist: string[];
}

type Section = 'general' | 'landing' | 'email' | 'payment' | 'api' | 'security';

const SECTIONS = [
  { id: 'general',  label: 'General',       icon: Globe,       desc: 'Site name, support, maintenance' },
  { id: 'landing',  label: 'Landing Page',  icon: Palette,     desc: 'Hero, colors, stats, CTA'       },
  { id: 'email',    label: 'Email Templates',icon: Mail,        desc: 'Welcome, transaction emails'     },
  { id: 'payment',  label: 'Payment',        icon: CreditCard,  desc: 'Monnify keys, deposit limits'   },
  { id: 'api',      label: 'API & Markup',   icon: Zap,         desc: 'GladTidings, auto-sync, markup' },
  { id: 'security', label: 'Security',       icon: Shield,      desc: 'Logins, registrations, sessions' },
];

const EMAIL_VARS: Record<string, string[]> = {
  welcome:     ['{{name}}', '{{email}}', '{{support_email}}'],
  transaction: ['{{name}}', '{{amount}}', '{{service}}', '{{status}}', '{{reference}}', '{{date}}', '{{support_email}}'],
};

export default function AdminSettings() {
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState<string | null>(null);

  // Settings state
  const [general,  setGeneral]  = useState<GeneralSettings>({ site_name: 'DashSub', tagline: 'Fast & Reliable VTU Services', support_email: 'support@dashsub.com', support_phone: '08012345678', maintenance_mode: false, maintenance_message: 'We are under maintenance. Please check back soon.' });
  const [landing,  setLanding]  = useState<LandingSettings>({ hero_title: 'Buy Data & Airtime Instantly', hero_subtitle: 'The fastest, cheapest and most reliable VTU platform in Nigeria.', hero_cta_text: 'Get Started Free', hero_cta_link: '/auth', show_stats: true, primary_color: '#53E6D4', accent_color: '#0D2E2E', show_features: true, stats: { users: '10,000+', transactions: '50,000+', networks: '4' } });
  const [email,    setEmail]    = useState<EmailSettings>({ from_name: 'DashSub', from_email: 'noreply@dashsub.com', welcome_subject: 'Welcome to DashSub!', welcome_body: 'Hi {{name}},\n\nWelcome to DashSub!\n\nYour account is ready. Fund your wallet and start buying data, airtime, and more instantly.\n\nBest regards,\nThe DashSub Team', transaction_subject: 'Transaction {{status}} - {{reference}}', transaction_body: 'Hi {{name}},\n\nYour transaction of ₦{{amount}} for {{service}} was {{status}}.\n\nReference: {{reference}}\nDate: {{date}}\n\nThank you for using DashSub!', support_footer: 'Need help? Contact {{support_email}}' });
  const [payment,  setPayment]  = useState<PaymentSettings>({ monnify_api_key: '', monnify_secret_key: '', monnify_contract_code: '', monnify_base_url: 'https://api.monnify.com', webhook_secret: '', min_deposit: 100, max_deposit: 1000000 });
  const [api,      setApi]      = useState<ApiSettings>({ gladtidings_token: '', gladtidings_base_url: 'https://www.gladtidingsdata.com/api', global_markup_percent: 15, auto_sync_enabled: true, auto_sync_hour: 2 });
  const [security, setSecurity] = useState<SecuritySettings>({ session_timeout_hours: 24, max_login_attempts: 5, require_2fa: false, allow_new_registrations: true, ip_whitelist: [] });

  // Password visibility
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const toggleSecret = (k: string) => setShowSecrets(p => ({ ...p, [k]: !p[k] }));

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.general)  setGeneral(data.general);
      if (data.landing)  setLanding(data.landing);
      if (data.email)    setEmail(data.email);
      if (data.payment)  setPayment(data.payment);
      if (data.api)      setApi(data.api);
      if (data.security) setSecurity(data.security);
    } catch { toast.error('Failed to load settings'); }
    setLoading(false);
  }

  async function saveSection(section: Section) {
    setSaving(true);
    const valueMap: Record<string, any> = { general, landing, email, payment, api, security };
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: section, value: valueMap[section] }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { toast.error('Failed: ' + result.error); return; }
      setSaved(section);
      toast.success('Settings saved ✓');
      setTimeout(() => setSaved(null), 2000);
    } catch { toast.error('Network error'); }
    setSaving(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  }

  function insertVar(field: string, variable: string, setter: any, obj: any) {
    setter({ ...obj, [field]: (obj[field] || '') + variable });
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <Loader2 style={{ width: 28, height: 28, color: '#53E6D4' }} className="spin" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin .8s linear infinite}`}</style>
    </div>
  );

  const SaveButton = ({ section }: { section: Section }) => (
    <button onClick={() => saveSection(section)} disabled={saving}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, background: saved === section ? '#4ade80' : '#53E6D4', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#0D2E2E', fontSize: 14, fontWeight: 800, transition: 'all .15s', boxShadow: '0 4px 18px rgba(83,230,212,0.25)', opacity: saving ? 0.8 : 1 }}>
      {saving ? <Loader2 style={{ width: 15, height: 15 }} className="spin" /> : saved === section ? <Check style={{ width: 15, height: 15 }} /> : <Save style={{ width: 15, height: 15 }} />}
      {saving ? 'Saving…' : saved === section ? 'Saved!' : 'Save Changes'}
    </button>
  );

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        input:focus, textarea:focus, select:focus { outline: none; border-color: rgba(83,230,212,0.4) !important; box-shadow: 0 0 0 3px rgba(83,230,212,0.08); }
        .nav-item { transition: all .13s; cursor: pointer; }
        .nav-item:hover { background: rgba(83,230,212,0.06) !important; }
        .var-chip { transition: all .12s; cursor: pointer; }
        .var-chip:hover { background: rgba(83,230,212,0.2) !important; }
        .toggle-row { transition: background .12s; cursor: pointer; }
        .toggle-row:hover { background: rgba(255,255,255,0.03) !important; }
        .copy-btn { transition: all .12s; cursor: pointer; }
        .copy-btn:hover { color: #53E6D4 !important; }
        /* Responsive */
        @media(max-width:768px) {
          .settings-wrap { flex-direction: column !important; }
          .settings-sidebar { width:100%!important; position:static!important; flex-direction:row!important; overflow-x:auto!important; scrollbar-width:none; padding:10px!important; border-right:none!important; border-bottom:1px solid rgba(255,255,255,0.07)!important; gap:6px!important; }
          .settings-sidebar::-webkit-scrollbar{display:none}
          .nav-item { min-width:110px!important; flex-direction:column!important; padding:10px!important; border-radius:12px!important; border:none!important; }
          .nav-desc { display:none!important; }
          .nav-arrow { display:none!important; }
        }
      `}</style>

      <div style={{ color: '#F4F7F7', fontFamily: "'Sora', sans-serif" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: '-.02em' }}>Settings</h1>
          <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.45)' }}>Configure your platform, integrations, and appearance</p>
        </div>

        <div className="settings-wrap" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── Sidebar ── */}
          <div className="settings-sidebar"
            style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 20, background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 10 }}>
            {SECTIONS.map(s => {
              const Icon   = s.icon;
              const active = activeSection === s.id;
              return (
                <button key={s.id} className="nav-item"
                  onClick={() => setActiveSection(s.id as Section)}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 12, border: 'none', background: active ? 'rgba(83,230,212,0.1)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                  <Icon style={{ width: 17, height: 17, color: active ? '#53E6D4' : 'rgba(244,247,247,0.4)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: active ? '#53E6D4' : 'rgba(244,247,247,0.7)' }}>{s.label}</p>
                    <p className="nav-desc" style={{ fontSize: 10, color: 'rgba(244,247,247,0.3)', marginTop: 1 }}>{s.desc}</p>
                  </div>
                  <ChevronRight className="nav-arrow" style={{ width: 13, height: 13, color: 'rgba(244,247,247,0.2)' }} />
                </button>
              );
            })}
          </div>

          {/* ── Content ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* ═══ GENERAL ═══ */}
            {activeSection === 'general' && (
              <div style={{ animation: 'fadeUp .25s ease' }}>
                <SectionCard title="General Settings" desc="Basic site information and operational settings">
                  <Grid2>
                    <Field label="Site Name" hint="Displayed in browser tab and emails">
                      <Input value={general.site_name} onChange={v => setGeneral({ ...general, site_name: v })} placeholder="DashSub" />
                    </Field>
                    <Field label="Tagline" hint="Short description shown on landing page">
                      <Input value={general.tagline} onChange={v => setGeneral({ ...general, tagline: v })} placeholder="Fast & Reliable VTU" />
                    </Field>
                    <Field label="Support Email">
                      <Input value={general.support_email} onChange={v => setGeneral({ ...general, support_email: v })} placeholder="support@dashsub.com" type="email" />
                    </Field>
                    <Field label="Support Phone">
                      <Input value={general.support_phone} onChange={v => setGeneral({ ...general, support_phone: v })} placeholder="08012345678" />
                    </Field>
                  </Grid2>

                  {/* Maintenance mode */}
                  <div style={{ marginTop: 20, padding: 18, borderRadius: 14, background: general.maintenance_mode ? 'rgba(250,204,21,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${general.maintenance_mode ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                    <div className="toggle-row"
                      onClick={() => setGeneral({ ...general, maintenance_mode: !general.maintenance_mode })}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: general.maintenance_mode ? 14 : 0, padding: 4, borderRadius: 8 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: general.maintenance_mode ? '#facc15' : '#F4F7F7', marginBottom: 3 }}>
                          {general.maintenance_mode ? '⚠️ Maintenance Mode is ON' : '🟢 Site is Live'}
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.45)' }}>
                          {general.maintenance_mode ? 'Users will see maintenance page' : 'Toggle to take site offline for maintenance'}
                        </p>
                      </div>
                      {general.maintenance_mode
                        ? <ToggleRight style={{ width: 30, height: 30, color: '#facc15', flexShrink: 0 }} />
                        : <ToggleLeft  style={{ width: 30, height: 30, color: 'rgba(244,247,247,0.3)', flexShrink: 0 }} />}
                    </div>
                    {general.maintenance_mode && (
                      <Field label="Maintenance Message" hint="Shown to users during maintenance">
                        <Textarea value={general.maintenance_message} onChange={v => setGeneral({ ...general, maintenance_message: v })} rows={3} />
                      </Field>
                    )}
                  </div>

                  <div style={{ marginTop: 20 }}><SaveButton section="general" /></div>
                </SectionCard>
              </div>
            )}

            {/* ═══ LANDING PAGE ═══ */}
            {activeSection === 'landing' && (
              <div style={{ animation: 'fadeUp .25s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SectionCard title="Hero Section" desc="Main headline and call-to-action on the landing page">
                  <Grid2>
                    <Field label="Hero Title" hint="Main headline — make it punchy">
                      <Input value={landing.hero_title} onChange={v => setLanding({ ...landing, hero_title: v })} placeholder="Buy Data & Airtime Instantly" />
                    </Field>
                    <Field label="CTA Button Text">
                      <Input value={landing.hero_cta_text} onChange={v => setLanding({ ...landing, hero_cta_text: v })} placeholder="Get Started Free" />
                    </Field>
                  </Grid2>
                  <Field label="Hero Subtitle" hint="Supporting text below the headline">
                    <Textarea value={landing.hero_subtitle} onChange={v => setLanding({ ...landing, hero_subtitle: v })} rows={2} />
                  </Field>
                  <Field label="CTA Button Link" hint="Where the button takes users">
                    <Input value={landing.hero_cta_link} onChange={v => setLanding({ ...landing, hero_cta_link: v })} placeholder="/auth" />
                  </Field>
                </SectionCard>

                <SectionCard title="Colors & Theme" desc="Brand colors used across the landing page">
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Primary Color', key: 'primary_color', hint: 'Main accent (default: teal)' },
                      { label: 'Accent / Background', key: 'accent_color', hint: 'Dark background color' },
                    ].map(({ label, key, hint }) => (
                      <div key={key} style={{ flex: 1, minWidth: 160 }}>
                        <Field label={label} hint={hint}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input type="color"
                              value={(landing as any)[key]}
                              onChange={e => setLanding({ ...landing, [key]: e.target.value })}
                              style={{ width: 44, height: 44, borderRadius: 10, border: '2px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 2, background: 'transparent' }}
                            />
                            <Input value={(landing as any)[key]} onChange={v => setLanding({ ...landing, [key]: v })} placeholder="#53E6D4" />
                          </div>
                          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: (landing as any)[key], color: key === 'primary_color' ? '#0D2E2E' : '#53E6D4', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                            Preview: {label}
                          </div>
                        </Field>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Stats Bar" desc="Numbers displayed on the landing page hero">
                  <div className="toggle-row"
                    onClick={() => setLanding({ ...landing, show_stats: !landing.show_stats })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', marginBottom: 16 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#F4F7F7' }}>Show Stats Bar</p>
                      <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.4)' }}>Display user count, transaction count on hero</p>
                    </div>
                    {landing.show_stats
                      ? <ToggleRight style={{ width: 26, height: 26, color: '#53E6D4' }} />
                      : <ToggleLeft  style={{ width: 26, height: 26, color: 'rgba(244,247,247,0.3)' }} />}
                  </div>
                  {landing.show_stats && (
                    <Grid3>
                      <Field label="Users Count">
                        <Input value={landing.stats.users} onChange={v => setLanding({ ...landing, stats: { ...landing.stats, users: v } })} placeholder="10,000+" />
                      </Field>
                      <Field label="Transactions">
                        <Input value={landing.stats.transactions} onChange={v => setLanding({ ...landing, stats: { ...landing.stats, transactions: v } })} placeholder="50,000+" />
                      </Field>
                      <Field label="Networks">
                        <Input value={landing.stats.networks} onChange={v => setLanding({ ...landing, stats: { ...landing.stats, networks: v } })} placeholder="4" />
                      </Field>
                    </Grid3>
                  )}
                  <SaveButton section="landing" />
                </SectionCard>
              </div>
            )}

            {/* ═══ EMAIL TEMPLATES ═══ */}
            {activeSection === 'email' && (
              <div style={{ animation: 'fadeUp .25s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>

                <SectionCard title="Email Sender" desc="Who emails appear to come from">
                  <Grid2>
                    <Field label="From Name" hint="Sender name users see">
                      <Input value={email.from_name} onChange={v => setEmail({ ...email, from_name: v })} placeholder="DashSub" />
                    </Field>
                    <Field label="From Email" hint="Sender email address">
                      <Input value={email.from_email} onChange={v => setEmail({ ...email, from_email: v })} placeholder="noreply@dashsub.com" type="email" />
                    </Field>
                  </Grid2>
                  <Field label="Support Footer" hint="Added at the bottom of every email">
                    <Input value={email.support_footer} onChange={v => setEmail({ ...email, support_footer: v })} placeholder="Need help? Contact {{support_email}}" />
                  </Field>
                </SectionCard>

                <SectionCard title="Welcome Email" desc="Sent when a new user registers">
                  <VarChips vars={EMAIL_VARS.welcome} onInsert={(v) => setEmail({ ...email, welcome_body: email.welcome_body + v })} />
                  <Field label="Subject">
                    <Input value={email.welcome_subject} onChange={v => setEmail({ ...email, welcome_subject: v })} placeholder="Welcome to DashSub!" />
                  </Field>
                  <Field label="Email Body" hint="Use {{variables}} for dynamic content">
                    <Textarea value={email.welcome_body} onChange={v => setEmail({ ...email, welcome_body: v })} rows={8} mono />
                  </Field>
                  {/* Preview */}
                  <EmailPreview subject={email.welcome_subject} body={email.welcome_body} fromName={email.from_name} />
                </SectionCard>

                <SectionCard title="Transaction Email" desc="Sent after every purchase">
                  <VarChips vars={EMAIL_VARS.transaction} onInsert={(v) => setEmail({ ...email, transaction_body: email.transaction_body + v })} />
                  <Field label="Subject" hint="Use {{status}} and {{reference}}">
                    <Input value={email.transaction_subject} onChange={v => setEmail({ ...email, transaction_subject: v })} />
                  </Field>
                  <Field label="Email Body">
                    <Textarea value={email.transaction_body} onChange={v => setEmail({ ...email, transaction_body: v })} rows={8} mono />
                  </Field>
                  <EmailPreview subject={email.transaction_subject} body={email.transaction_body} fromName={email.from_name} />
                  <div style={{ marginTop: 16 }}><SaveButton section="email" /></div>
                </SectionCard>
              </div>
            )}

            {/* ═══ PAYMENT ═══ */}
            {activeSection === 'payment' && (
              <div style={{ animation: 'fadeUp .25s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SectionCard title="Monnify Integration" desc="Payment gateway for wallet funding">
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(83,230,212,0.06)', border: '1px solid rgba(83,230,212,0.15)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ExternalLink style={{ width: 13, height: 13, color: '#53E6D4', flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: 'rgba(83,230,212,0.8)' }}>
                      Get your keys from <span style={{ fontWeight: 700 }}>app.monnify.com</span> → Settings → API Keys
                    </p>
                  </div>
                  <Grid2>
                    <Field label="API Key" hint="Public key from Monnify dashboard">
                      <SecretInput value={payment.monnify_api_key} onChange={(v: string) => setPayment({ ...payment, monnify_api_key: v })} id="monnify_api" placeholder="MK_TEST_xxxx…" showSecrets={showSecrets} toggle={toggleSecret} onCopy={copyToClipboard} />
                    </Field>
                    <Field label="Secret Key" hint="Keep this private — never expose in frontend">
                      <SecretInput value={payment.monnify_secret_key} onChange={(v: string) => setPayment({ ...payment, monnify_secret_key: v })} id="monnify_secret" placeholder="SK_xxxx…" showSecrets={showSecrets} toggle={toggleSecret} onCopy={copyToClipboard} />
                    </Field>
                    <Field label="Contract Code" hint="From Monnify merchant dashboard">
                      <SecretInput value={payment.monnify_contract_code} onChange={(v: string) => setPayment({ ...payment, monnify_contract_code: v })} id="monnify_contract" placeholder="xxxxxxxxxxxx" showSecrets={showSecrets} toggle={toggleSecret} onCopy={copyToClipboard} />
                    </Field>
                    <Field label="Webhook Secret" hint="Used to verify Monnify webhook calls">
                      <SecretInput value={payment.webhook_secret} onChange={(v: string) => setPayment({ ...payment, webhook_secret: v })} id="webhook_secret" placeholder="your-webhook-secret" showSecrets={showSecrets} toggle={toggleSecret} onCopy={copyToClipboard} />
                    </Field>
                  </Grid2>
                  <Field label="Base URL" hint="Use sandbox URL for testing">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['https://api.monnify.com', 'https://sandbox.monnify.com'].map(url => (
                        <button key={url} onClick={() => setPayment({ ...payment, monnify_base_url: url })}
                          style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${payment.monnify_base_url === url ? 'rgba(83,230,212,0.4)' : 'rgba(255,255,255,0.08)'}`, background: payment.monnify_base_url === url ? 'rgba(83,230,212,0.1)' : 'transparent', color: payment.monnify_base_url === url ? '#53E6D4' : 'rgba(244,247,247,0.45)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {url.includes('sandbox') ? '🧪 Sandbox' : '🚀 Production'}
                        </button>
                      ))}
                    </div>
                  </Field>
                </SectionCard>

                <SectionCard title="Deposit Limits" desc="Control minimum and maximum wallet top-up amounts">
                  <Grid2>
                    <Field label="Minimum Deposit (₦)" hint="Smallest amount a user can fund">
                      <Input value={String(payment.min_deposit)} onChange={v => setPayment({ ...payment, min_deposit: parseInt(v) || 0 })} type="number" placeholder="100" />
                    </Field>
                    <Field label="Maximum Deposit (₦)" hint="Largest amount per transaction">
                      <Input value={String(payment.max_deposit)} onChange={v => setPayment({ ...payment, max_deposit: parseInt(v) || 0 })} type="number" placeholder="1000000" />
                    </Field>
                  </Grid2>
                  <SaveButton section="payment" />
                </SectionCard>
              </div>
            )}

            {/* ═══ API & MARKUP ═══ */}
            {activeSection === 'api' && (
              <div style={{ animation: 'fadeUp .25s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SectionCard title="GladTidings API" desc="Data purchase provider configuration">
                  <Field label="API Token" hint="Your GladTidings authentication token">
                    <SecretInput value={api.gladtidings_token} onChange={(v: string) => setApi({ ...api, gladtidings_token: v })} id="glad_token" placeholder="5f885ebf…" showSecrets={showSecrets} toggle={toggleSecret} onCopy={copyToClipboard} />
                  </Field>
                  <Field label="Base URL">
                    <Input value={api.gladtidings_base_url} onChange={v => setApi({ ...api, gladtidings_base_url: v })} placeholder="https://www.gladtidingsdata.com/api" />
                  </Field>
                  {/* Test connection */}
                  <button
                    onClick={async () => {
                      toast.info('Testing connection…');
                      try {
                        const res = await fetch('/api/sync-plans', { method: 'POST' });
                        const d   = await res.json();
                        d.success ? toast.success('✅ Connection OK! ' + d.message) : toast.error('❌ ' + d.error);
                      } catch { toast.error('Connection failed'); }
                    }}
                    style={{ marginTop: 8, padding: '9px 18px', borderRadius: 10, background: 'rgba(83,230,212,0.1)', border: '1px solid rgba(83,230,212,0.25)', color: '#53E6D4', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Server style={{ width: 14, height: 14 }} /> Test Connection & Sync
                  </button>
                </SectionCard>

                <SectionCard title="Global Markup" desc="Default profit margin applied to all data plan prices">
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Field label="Markup Percentage (%)" hint="Applied when syncing plans (e.g. 15 = 15%)">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="range" min={0} max={50} step={1} value={api.global_markup_percent}
                          onChange={e => setApi({ ...api, global_markup_percent: parseInt(e.target.value) })}
                          style={{ flex: 1, accentColor: '#53E6D4' }} />
                        <div style={{ width: 60, padding: '8px 10px', borderRadius: 10, background: 'rgba(83,230,212,0.1)', border: '1px solid rgba(83,230,212,0.25)', color: '#53E6D4', fontSize: 16, fontWeight: 900, textAlign: 'center', fontFamily: 'monospace' }}>
                          {api.global_markup_percent}%
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.4)', marginTop: 8 }}>
                        Example: ₦1,000 cost → ₦{(1000 * (1 + api.global_markup_percent / 100)).toFixed(0)} selling price
                      </p>
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard title="Auto-Sync Schedule" desc="Automatically sync data plans from GladTidings daily">
                  <div className="toggle-row"
                    onClick={() => setApi({ ...api, auto_sync_enabled: !api.auto_sync_enabled })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', marginBottom: api.auto_sync_enabled ? 16 : 0 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#F4F7F7' }}>Enable Auto-Sync</p>
                      <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.4)' }}>Automatically refresh plan prices every day</p>
                    </div>
                    {api.auto_sync_enabled
                      ? <ToggleRight style={{ width: 26, height: 26, color: '#53E6D4' }} />
                      : <ToggleLeft  style={{ width: 26, height: 26, color: 'rgba(244,247,247,0.3)' }} />}
                  </div>
                  {api.auto_sync_enabled && (
                    <Field label="Sync Hour (24h)" hint="What hour of the day to run the sync (server time)">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[0, 1, 2, 3, 4, 5].map(h => (
                          <button key={h} onClick={() => setApi({ ...api, auto_sync_hour: h })}
                            style={{ padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${api.auto_sync_hour === h ? 'rgba(83,230,212,0.4)' : 'rgba(255,255,255,0.08)'}`, background: api.auto_sync_hour === h ? 'rgba(83,230,212,0.1)' : 'transparent', color: api.auto_sync_hour === h ? '#53E6D4' : 'rgba(244,247,247,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {h === 0 ? 'Midnight' : `${h}AM`}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}
                  <SaveButton section="api" />
                </SectionCard>
              </div>
            )}

            {/* ═══ SECURITY ═══ */}
            {activeSection === 'security' && (
              <div style={{ animation: 'fadeUp .25s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SectionCard title="Access Control" desc="Control who can register and how long sessions last">
                  {[
                    { key: 'allow_new_registrations', label: 'Allow New Registrations', desc: 'Users can sign up for a new account', color: '#4ade80' },
                    { key: 'require_2fa',              label: 'Require 2FA',              desc: 'Force two-factor auth for all admin logins', color: '#a78bfa' },
                  ].map(({ key, label, desc, color }) => {
                    const val = (security as any)[key];
                    return (
                      <div key={key} className="toggle-row"
                        onClick={() => setSecurity({ ...security, [key]: !val })}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, marginBottom: 8, background: 'rgba(255,255,255,0.03)' }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#F4F7F7', marginBottom: 3 }}>{label}</p>
                          <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.4)' }}>{desc}</p>
                        </div>
                        {val
                          ? <ToggleRight style={{ width: 28, height: 28, color, flexShrink: 0 }} />
                          : <ToggleLeft  style={{ width: 28, height: 28, color: 'rgba(244,247,247,0.25)', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </SectionCard>

                <SectionCard title="Session & Login" desc="Security limits for authentication">
                  <Grid2>
                    <Field label="Session Timeout (hours)" hint="Auto logout after inactivity">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[1, 6, 12, 24, 48, 168].map(h => (
                          <button key={h} onClick={() => setSecurity({ ...security, session_timeout_hours: h })}
                            style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${security.session_timeout_hours === h ? 'rgba(83,230,212,0.4)' : 'rgba(255,255,255,0.08)'}`, background: security.session_timeout_hours === h ? 'rgba(83,230,212,0.1)' : 'transparent', color: security.session_timeout_hours === h ? '#53E6D4' : 'rgba(244,247,247,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {h >= 168 ? '7 days' : h === 1 ? '1h' : `${h}h`}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Max Login Attempts" hint="Lock account after this many failed tries">
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[3, 5, 10, 20].map(n => (
                          <button key={n} onClick={() => setSecurity({ ...security, max_login_attempts: n })}
                            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${security.max_login_attempts === n ? 'rgba(83,230,212,0.4)' : 'rgba(255,255,255,0.08)'}`, background: security.max_login_attempts === n ? 'rgba(83,230,212,0.1)' : 'transparent', color: security.max_login_attempts === n ? '#53E6D4' : 'rgba(244,247,247,0.4)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </Grid2>
                  <SaveButton section="security" />
                </SectionCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helper components ──

function SectionCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 24, marginBottom: 0 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.4)', marginBottom: 22 }}>{desc}</p>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.45)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 8 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.28)', marginTop: 5 }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 14, fontFamily: "'Sora', sans-serif", boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s' }} />
  );
}

function Textarea({ value, onChange, rows = 4, mono = false }: { value: string; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: mono ? 12 : 14, fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Sora', sans-serif", resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
  );
}

function SecretInput({ value, onChange, id, placeholder, showSecrets, toggle, onCopy }: any) {
  const show = showSecrets[id];
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={e => onChange(e.target.value)} type={show ? 'text' : 'password'} placeholder={placeholder}
        style={{ width: '100%', padding: '11px 80px 11px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box' }} />
      <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
        <button className="copy-btn" onClick={() => onCopy(value)} title="Copy"
          style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(244,247,247,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Copy style={{ width: 12, height: 12 }} />
        </button>
        <button className="copy-btn" onClick={() => toggle(id)} title="Toggle visibility"
          style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(244,247,247,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {show ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
        </button>
      </div>
    </div>
  );
}

function VarChips({ vars, onInsert }: { vars: string[]; onInsert: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'flex', alignItems: 'center', marginRight: 4 }}>Insert:</span>
      {vars.map(v => (
        <button key={v} className="var-chip" onClick={() => onInsert(v)}
          style={{ padding: '3px 9px', borderRadius: 7, background: 'rgba(83,230,212,0.1)', border: '1px solid rgba(83,230,212,0.2)', color: '#53E6D4', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace' }}>
          {v}
        </button>
      ))}
    </div>
  );
}

function EmailPreview({ subject, body, fromName }: { subject: string; body: string; fromName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)}
        style={{ fontSize: 12, color: '#53E6D4', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Eye style={{ width: 13, height: 13 }} /> {open ? 'Hide' : 'Preview'} email
      </button>
      {open && (
        <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ background: '#1a1a2e', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>From: <span style={{ color: '#fff' }}>{fromName}</span></p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{subject || '(no subject)'}</p>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px' }}>
            <pre style={{ fontSize: 13, color: '#333', fontFamily: 'sans-serif', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{body}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>{children}</div>;
}
function Grid3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>{children}</div>;
}