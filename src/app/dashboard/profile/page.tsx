'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Wallet, Calendar, Mail, Shield, LogOut,
  Edit2, Eye, EyeOff, Copy, Check, ArrowLeft,
  Loader2, CheckCircle2, XCircle, Zap, ChevronRight,
  Phone, Lock, Bell, Trash2, Share2, Key, Star,
  ToggleLeft, ToggleRight, AlertTriangle, RefreshCw,
  CreditCard, TrendingUp, Package, BadgeCheck,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─────────────────────────────────────────────────────── */

export default function Profile() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet]       = useState<{ balance: number } | null>(null);
  const [showBalance, setShowBalance] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [recentTx, setRecentTx]   = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'danger'>('profile');

  /* ── profile fields ── */
  const [fullName, setFullName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving]       = useState(false);

  /* ── password change ── */
  const [showPwSection, setShowPwSection] = useState(false);
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPw, setConfirmPw]         = useState('');
  const [changingPw, setChangingPw]       = useState(false);
  const [showNewPw, setShowNewPw]         = useState(false);

  /* ── referral ── */
  const [referralCode, setReferralCode] = useState('');
  const [copiedKey, setCopiedKey]       = useState<string | null>(null);

  /* ── notifications ── */
  const [notifSettings, setNotifSettings] = useState({
    transactions:  true,
    promotions:    true,
    security:      true,
    newsletters:   false,
    sms:           true,
    pushEnabled:   false,
  });

  /* ── delete account ── */
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]           = useState(false);

  /* ── KYC ── */
  const [kycStatus] = useState<'Not Verified' | 'Pending' | 'Verified'>('Not Verified');

  /* ─────────── Load data ─────────── */
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    const userId = session.user.id;

    async function load() {
      setLoading(true);
      const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', userId).single();
      if (w) setWallet(w);

      const { data: p } = await supabase.from('profiles')
        .select('full_name, phone_number, referral_code').eq('id', userId).single();
      if (p) {
        setFullName(p.full_name || '');
        setPhone(p.phone_number || '');
        setReferralCode(p.referral_code || '');
      }

      const { data: t } = await supabase.from('transactions').select('amount,type,status,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
      setRecentTx(t || []);
      setLoading(false);
    }
    load();
  }, [session, sessionLoading, router]);

  /* ─────────── Handlers ─────────── */
  const saveProfile = async () => {
    if (!session?.user.id) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id, full_name: fullName,
      phone_number: phone, updated_at: new Date().toISOString(),
    });
    if (error) toast.error('Failed to save profile');
    else { toast.success('Profile updated ✅'); setIsEditing(false); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    if (newPassword !== confirmPw) return toast.error('Passwords do not match');
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success('Password changed successfully 🔒');
      setNewPassword(''); setConfirmPw(''); setShowPwSection(false);
    }
    setChangingPw(false);
  };

  const generateReferral = async () => {
    if (referralCode) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('profiles').update({ referral_code: code }).eq('id', session?.user.id);
    if (!error) { setReferralCode(code); toast.success('Referral code created! 🎉'); }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied!');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return toast.error('Type DELETE to confirm');
    setDeleting(true);
    // In production: call a server action that deletes the user via admin client
    toast.error('Account deletion requires server-side action. Contact support.');
    setDeleting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  /* ─────────── Derived ─────────── */
  if (sessionLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#0D2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 38, height: 38, border: '3px solid rgba(83,230,212,.2)', borderTopColor: '#53E6D4', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
    </div>
  );

  const displayName  = fullName || session?.user.email?.split('@')[0] || 'User';
  const avatarLetter = (fullName?.[0] || session?.user.email?.[0] || 'U').toUpperCase();
  const joinDate     = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const referralLink = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth?ref=${referralCode}`
    : '';

  const TABS = [
    { id: 'profile',       label: 'Profile',       Icon: User      },
    { id: 'security',      label: 'Security',      Icon: Lock      },
    { id: 'notifications', label: 'Alerts',        Icon: Bell      },
    { id: 'danger',        label: 'More',          Icon: Package   },
  ] as const;

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
          --mint-glow:   rgba(83,230,212,0.28);
          --muted:       rgba(244,247,247,0.40);
          --border:      rgba(255,255,255,0.07);
          --font: 'Sora', sans-serif;
          --mono: 'IBM Plex Mono', monospace;
        }
        body { background: var(--primary); font-family: var(--font); -webkit-font-smoothing: antialiased; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
        .a1{animation:fadeUp .3s ease .04s both;}
        .a2{animation:fadeUp .3s ease .09s both;}
        .a3{animation:fadeUp .3s ease .14s both;}
        .a4{animation:fadeUp .3s ease .19s both;}
        input { font-family: var(--font); }
        .field-input {
          width: 100%; background: rgba(0,0,0,.25);
          border: 1px solid var(--border); border-radius: 12px;
          padding: 11px 14px; color: var(--gray); font-size: 14px;
          font-weight: 600; outline: none; transition: border-color .2s;
          font-family: var(--font);
        }
        .field-input:focus { border-color: var(--mint-border); }
        .field-input:disabled { opacity: .5; cursor: not-allowed; }
        .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,.05); transition: background .13s; }
        .setting-row:last-child { border-bottom: none; }
        .setting-row:hover { background: rgba(83,230,212,.025); }
        .toggle { width: 44px; height: 24px; border-radius: 12px; position: relative; cursor: pointer; border: none; transition: background .2s; flex-shrink: 0; }
        .toggle-knob { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: left .2s; }
        .tab-btn { transition: all .15s ease; cursor: pointer; border: none; outline: none; font-family: var(--font); }
        .tab-btn:hover:not(.tab-active) { color: var(--mint) !important; background: var(--mint-dim) !important; }
        .action-btn { transition: all .16s ease; cursor: pointer; border: none; outline: none; font-family: var(--font); }
        .action-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .action-btn:active:not(:disabled) { transform: scale(.97); }
        .copy-btn { transition: background .14s; cursor: pointer; border: none; outline: none; }
        .copy-btn:hover { background: rgba(83,230,212,.2) !important; }
        .back-link:hover { color: var(--gray) !important; }
        .back-link:hover .arrow { transform: translateX(-3px); }
        .arrow { transition: transform .14s; }
        .stat-card:hover { border-color: var(--mint-border) !important; }
        .row-btn:hover { background: rgba(83,230,212,.03) !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)' }}>

        {/* ── NAV ── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,230,212,.08)' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/dashboard" className="back-link" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 600, transition: 'color .14s' }}>
              <ArrowLeft className="arrow" style={{ width: 16, height: 16 }} />
              Back
            </Link>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray)' }}>Profile & Settings</span>
            <button onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(239,68,68,.6)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)' }}
              onMouseOver={(e) => { (e.currentTarget.style.color='#ef4444'); }}
              onMouseOut={(e)  => { (e.currentTarget.style.color='rgba(239,68,68,.6)'); }}>
              <LogOut style={{ width: 15, height: 15 }} /> Logout
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── HERO PROFILE CARD ── */}
          <div className="a1" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 22, padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(83,230,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* Avatar */}
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--mint-dim)', border: '2px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28, color: 'var(--mint)', fontFamily: 'var(--mono)', flexShrink: 0, boxShadow: '0 0 20px var(--mint-glow)' }}>
                {avatarLetter}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--gray)', letterSpacing: '-.02em' }}>{displayName}</h2>
                  {kycStatus === 'Verified' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#4ade80', textTransform: 'uppercase' }}>
                      <BadgeCheck style={{ width: 10, height: 10 }} /> Verified
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontFamily: 'var(--mono)' }}>{session?.user.email}</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                    <Calendar style={{ width: 12, height: 12 }} /> Joined {joinDate}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setShowBalance(v => !v)}>
                    <Wallet style={{ width: 12, height: 12 }} />
                    {showBalance
                      ? `₦${wallet?.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 }) || '0.00'}`
                      : '₦ ••••••'}
                    {showBalance ? <EyeOff style={{ width: 10, height: 10 }} /> : <Eye style={{ width: 10, height: 10 }} />}
                  </div>
                </div>
              </div>

              {/* Edit button */}
              <button className="action-btn"
                onClick={() => { if (isEditing) saveProfile(); else setIsEditing(true); }}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', borderRadius: 12, color: 'var(--mint)', fontSize: 12, fontWeight: 700, opacity: saving ? .6 : 1, flexShrink: 0 }}>
                {saving ? <div style={{ width: 14, height: 14, border: '2px solid rgba(83,230,212,.3)', borderTopColor: 'var(--mint)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> : <Edit2 style={{ width: 14, height: 14 }} />}
                {isEditing ? 'Save' : 'Edit'}
              </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 }}>
              {[
                { label: 'Wallet',    value: showBalance ? `₦${wallet?.balance.toLocaleString('en-NG', { minimumFractionDigits: 0 }) || '0'}` : '••••', Icon: Wallet },
                { label: 'Transactions', value: recentTx.length > 0 ? '3+' : '0', Icon: TrendingUp },
                { label: 'KYC Status',   value: kycStatus,                          Icon: Shield    },
              ].map((s, i) => (
                <div key={i} className="stat-card" style={{ background: 'var(--primary-mid, #122f2f)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '12px 14px', transition: 'border-color .2s' }}>
                  <s.Icon style={{ width: 14, height: 14, color: 'rgba(83,230,212,.5)', marginBottom: 6 }} />
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray)', fontFamily: 'var(--mono)', marginBottom: 2 }}>{s.value}</p>
                  <p style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── TABS ── */}
          <div className="a2" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 16, padding: 5, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} className={`tab-btn${active ? ' tab-active' : ''}`}
                  onClick={() => setActiveTab(id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '9px 6px', borderRadius: 12, background: active ? 'var(--mint)' : 'transparent', color: active ? 'var(--carbon)' : 'var(--muted)', fontSize: 11, fontWeight: 800 }}>
                  <Icon style={{ width: 13, height: 13 }} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* ══════════════════ PROFILE TAB ══════════════════ */}
          {activeTab === 'profile' && (
            <div className="a3" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Edit fields */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.14em', textTransform: 'uppercase' }}>Personal Info</p>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Full Name</label>
                  <input className="field-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" disabled={!isEditing} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <input className="field-input" value={session?.user.email || ''} disabled style={{ paddingRight: 44 }} />
                    <button className="copy-btn" onClick={() => copyText(session?.user.email || '', 'email')}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 8, background: 'rgba(83,230,212,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mint)', transition: 'background .14s' }}>
                      {copiedKey === 'email' ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Phone Number</label>
                  <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g,'').slice(0,11))} placeholder="08012345678" disabled={!isEditing} style={{ fontFamily: 'var(--mono)' }} />
                </div>

                {isEditing && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="action-btn" onClick={saveProfile} disabled={saving}
                      style={{ flex: 1, background: 'var(--mint)', color: 'var(--carbon)', borderRadius: 12, height: 44, fontSize: 13, fontWeight: 800, opacity: saving ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      {saving ? <div style={{ width: 16, height: 16, border: '2px solid rgba(8,12,12,.3)', borderTopColor: 'var(--carbon)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> : null}
                      Save Changes
                    </button>
                    <button className="action-btn" onClick={() => setIsEditing(false)}
                      style={{ padding: '0 20px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, height: 44, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Referral section */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(251,191,36,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Star style={{ width: 15, height: 15, color: '#fbbf24' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Referral Program</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)' }}>Earn ₦500 per active referral</p>
                    </div>
                  </div>
                  <span style={{ background: 'rgba(251,191,36,.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,.2)', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase' }}>HOT</span>
                </div>

                {referralCode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Your Code</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, color: 'var(--mint)', flex: 1 }}>{referralCode}</span>
                        <button className="copy-btn" onClick={() => copyText(referralCode, 'code')}
                          style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mint)' }}>
                          {copiedKey === 'code' ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                        </button>
                      </div>
                    </div>
                    {referralLink && (
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Referral Link</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralLink}</span>
                          <button className="copy-btn" onClick={() => copyText(referralLink, 'link')}
                            style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mint)', flexShrink: 0 }}>
                            {copiedKey === 'link' ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="action-btn" onClick={generateReferral}
                    style={{ width: '100%', background: 'var(--mint)', color: 'var(--carbon)', borderRadius: 12, height: 44, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 16px var(--mint-glow)' }}>
                    <Zap style={{ width: 15, height: 15 }} /> Generate Referral Code
                  </button>
                )}
              </div>

              {/* KYC */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: kycStatus === 'Verified' ? 'rgba(74,222,128,.1)' : 'rgba(250,204,21,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {kycStatus === 'Verified'
                        ? <CheckCircle2 style={{ width: 18, height: 18, color: '#4ade80' }} />
                        : <Shield style={{ width: 18, height: 18, color: '#facc15' }} />
                      }
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Identity Verification</p>
                      <p style={{ fontSize: 10, color: kycStatus === 'Verified' ? '#4ade80' : '#facc15', fontWeight: 600 }}>{kycStatus}</p>
                    </div>
                  </div>
                  {kycStatus !== 'Verified' && (
                    <button className="action-btn"
                      style={{ padding: '8px 14px', background: 'var(--mint-dim)', border: '1px solid var(--mint-border)', borderRadius: 10, color: 'var(--mint)', fontSize: 12, fontWeight: 700 }}>
                      Verify Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════ SECURITY TAB ══════════════════ */}
          {activeTab === 'security' && (
            <div className="a3" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Change Password */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, overflow: 'hidden' }}>
                <button className="row-btn" onClick={() => setShowPwSection(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background .13s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(96,165,250,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Key style={{ width: 17, height: 17, color: '#60a5fa' }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Change Password</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)' }}>Update your account password</p>
                    </div>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: 'var(--muted)', transform: showPwSection ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                </button>

                {showPwSection && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input className="field-input" type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" style={{ paddingRight: 44 }} />
                        <button onClick={() => setShowNewPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                          {showNewPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Confirm Password</label>
                      <input className="field-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter password" />
                    </div>
                    {/* Password strength bar */}
                    {newPassword.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          {[1,2,3,4].map(i => {
                            const strength = Math.min(Math.floor(newPassword.length / 3), 4);
                            return <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? (strength <= 1 ? '#ef4444' : strength <= 2 ? '#facc15' : strength <= 3 ? '#60a5fa' : '#4ade80') : 'rgba(255,255,255,.1)', transition: 'background .2s' }} />;
                          })}
                        </div>
                        <p style={{ fontSize: 9, color: 'var(--muted)' }}>
                          {newPassword.length < 4 ? 'Weak' : newPassword.length < 8 ? 'Fair' : newPassword.length < 12 ? 'Good' : 'Strong'}
                        </p>
                      </div>
                    )}
                    <button className="action-btn" onClick={changePassword} disabled={changingPw || !newPassword || !confirmPw}
                      style={{ background: 'var(--mint)', color: 'var(--carbon)', borderRadius: 12, height: 44, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 16px var(--mint-glow)', opacity: (!newPassword || !confirmPw) ? .5 : 1 }}>
                      {changingPw ? <div style={{ width: 16, height: 16, border: '2px solid rgba(8,12,12,.3)', borderTopColor: 'var(--carbon)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> : <Lock style={{ width: 15, height: 15 }} />}
                      Update Password
                    </button>
                  </div>
                )}
              </div>

              {/* 2FA */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(192,132,252,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield style={{ width: 17, height: 17, color: '#c084fc' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Two-Factor Authentication</p>
                    <p style={{ fontSize: 10, color: 'var(--muted)' }}>Extra layer of account security</p>
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#facc15', background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.2)', padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase' }}>Soon</span>
              </div>

              {/* Passcode lock */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(83,230,212,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock style={{ width: 17, height: 17, color: 'var(--mint)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Payment Passcode</p>
                    <p style={{ fontSize: 10, color: 'var(--muted)' }}>PIN required before every payment</p>
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#facc15', background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.2)', padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase' }}>Soon</span>
              </div>

              {/* Active sessions */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RefreshCw style={{ width: 17, height: 17, color: '#f97316' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>Active Session</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)' }}>Currently logged in device</p>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray)', marginBottom: 2 }}>This browser</p>
                    <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{session?.user.email}</p>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#4ade80', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', padding: '3px 8px', borderRadius: 20 }}>Active</span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════ NOTIFICATIONS TAB ══════════════════ */}
          {activeTab === 'notifications' && (
            <div className="a3" style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.14em', textTransform: 'uppercase' }}>Notification Preferences</p>
              </div>

              {([
                { key: 'transactions', label: 'Transaction Alerts',  sub: 'Get notified for every debit/credit',   color: '#4ade80' },
                { key: 'security',     label: 'Security Alerts',     sub: 'Login and suspicious activity alerts',  color: '#f87171' },
                { key: 'promotions',   label: 'Promotions & Offers', sub: 'Cashback, bonuses and special deals',   color: '#fbbf24' },
                { key: 'sms',          label: 'SMS Notifications',   sub: 'Receive alerts via text message',       color: '#60a5fa' },
                { key: 'newsletters',  label: 'Newsletters',         sub: 'Monthly updates and product news',      color: '#c084fc' },
                { key: 'pushEnabled',  label: 'Push Notifications',  sub: 'Browser push notifications',           color: 'var(--mint)' },
              ] as const).map(({ key, label, sub, color }) => {
                const on = notifSettings[key];
                return (
                  <div key={key} className="setting-row">
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)', marginBottom: 2 }}>{label}</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</p>
                    </div>
                    <button className="toggle"
                      onClick={() => setNotifSettings(p => ({ ...p, [key]: !p[key] }))}
                      style={{ background: on ? color : 'rgba(255,255,255,.1)' }}>
                      <div className="toggle-knob" style={{ left: on ? '23px' : '3px' }} />
                    </button>
                  </div>
                );
              })}

              <div style={{ padding: '14px 20px' }}>
                <button className="action-btn"
                  style={{ width: '100%', background: 'var(--mint)', color: 'var(--carbon)', borderRadius: 12, height: 44, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px var(--mint-glow)' }}>
                  <Check style={{ width: 15, height: 15 }} /> Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════ MORE TAB ══════════════════ */}
          {activeTab === 'danger' && (
            <div className="a3" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Quick links */}
              <div style={{ background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.14em', textTransform: 'uppercase' }}>Quick Links</p>
                </div>
                {[
                  { label: 'Transaction History', sub: 'View all your transactions',   href: '/dashboard/transactions', Icon: History,    color: '#60a5fa' },
                  { label: 'Fund Wallet',          sub: 'Add money to your wallet',     href: '/dashboard/fund',         Icon: CreditCard, color: 'var(--mint)' },
                  { label: 'Buy Data',             sub: 'Purchase data bundles',        href: '/dashboard/services/buy-data', Icon: Zap,   color: '#c084fc' },
                  { label: 'Referrals',            sub: 'Earn from your referrals',     href: '/dashboard/referrals',    Icon: Share2,     color: '#fbbf24' },
                ].map(({ label, sub, href, Icon, color }) => (
                  <Link key={href} href={href} className="row-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', textDecoration: 'none', transition: 'background .13s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon style={{ width: 16, height: 16, color }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>{label}</p>
                        <p style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</p>
                      </div>
                    </div>
                    <ChevronRight style={{ width: 15, height: 15, color: 'var(--muted)' }} />
                  </Link>
                ))}
              </div>

              {/* Delete account */}
              <div style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.18)', borderRadius: 20, padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle style={{ width: 17, height: 17, color: '#ef4444' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>Delete Account</p>
                    <p style={{ fontSize: 10, color: 'rgba(239,68,68,.5)' }}>This action is permanent and irreversible</p>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'rgba(244,247,247,.4)', lineHeight: 1.6, marginBottom: 14 }}>
                  Deleting your account will permanently remove all your data, wallet balance, and transaction history. You will lose access immediately.
                </p>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'rgba(239,68,68,.6)', fontWeight: 600, marginBottom: 6 }}>Type <strong>DELETE</strong> to confirm</label>
                  <input className="field-input" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={{ borderColor: deleteConfirm === 'DELETE' ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.07)' }} />
                </div>
                <button className="action-btn" onClick={deleteAccount} disabled={deleting || deleteConfirm !== 'DELETE'}
                  style={{ width: '100%', background: deleteConfirm === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,.15)', color: deleteConfirm === 'DELETE' ? 'white' : 'rgba(239,68,68,.4)', borderRadius: 12, height: 44, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: deleting ? .7 : 1, transition: 'all .2s' }}>
                  {deleting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> : <Trash2 style={{ width: 15, height: 15 }} />}
                  Delete My Account
                </button>
              </div>

              {/* Logout */}
              <button className="action-btn" onClick={handleLogout}
                style={{ width: '100%', background: 'var(--carbon)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, height: 52, fontSize: 14, fontWeight: 700, color: 'rgba(239,68,68,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}
                onMouseOver={(e) => { (e.currentTarget.style.background='rgba(239,68,68,.07)'); (e.currentTarget.style.color='#ef4444'); }}
                onMouseOut={(e)  => { (e.currentTarget.style.background='var(--carbon)');       (e.currentTarget.style.color='rgba(239,68,68,.7)'); }}>
                <LogOut style={{ width: 17, height: 17 }} /> Log Out of DashSub
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}