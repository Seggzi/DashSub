'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Bell, Send, Users, User, Megaphone, CheckCircle2,
  Clock, Trash2, Loader2, Info, Zap, AlertTriangle,
  Star, Gift, Search, Check, ChevronDown, ChevronUp,
  Sparkles, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserRecord { id: string; full_name: string | null; }
interface NotifRecord {
  id: string; user_id: string | null; title: string;
  message: string; type: string; is_read: boolean;
  action_url: string | null; created_at: string;
}

const TYPES = [
  { id: 'info',    label: 'Info',    icon: Info,          color: '#53E6D4', bg: 'rgba(83,230,212,0.12)'  },
  { id: 'success', label: 'Success', icon: CheckCircle2,  color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  { id: 'warning', label: 'Warning', icon: AlertTriangle, color: '#facc15', bg: 'rgba(250,204,21,0.12)'  },
  { id: 'feature', label: 'Feature', icon: Star,          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { id: 'promo',   label: 'Promo',   icon: Gift,          color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { id: 'alert',   label: 'Alert',   icon: Zap,           color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
];

const TEMPLATES = [
  { category: '💰 Pricing', items: [
    { title: '📈 Data Prices Updated', message: 'We have updated our data plan prices. Check out the latest rates and save more on your purchases!', type: 'info', url: '/dashboard/services/buy-data' },
    { title: '🎉 Price Drop Alert!', message: 'Great news! We have reduced prices on selected data plans. Buy now and enjoy more data for less!', type: 'promo', url: '/dashboard/services/buy-data' },
    { title: '⚠️ Price Adjustment Notice', message: 'Due to changes from our network providers, some data plan prices have been adjusted. We appreciate your understanding.', type: 'warning', url: null },
  ]},
  { category: '✨ Features', items: [
    { title: '🚀 New Feature: Cable TV', message: 'You can now pay for DSTV, GOtv, and Startime directly from your DashSub wallet. Try it now!', type: 'feature', url: '/dashboard/cable' },
    { title: '⚡ New: Electricity Bills', message: 'Pay your electricity bills instantly with DashSub. Available for all DISCOs nationwide!', type: 'feature', url: '/dashboard/electricity' },
    { title: '💳 Virtual Account Active', message: 'Fund your wallet faster with your dedicated virtual bank account. Find it in your dashboard!', type: 'success', url: '/dashboard/fund' },
  ]},
  { category: '🎁 Promotions', items: [
    { title: '🎁 Referral Program is LIVE!', message: 'Earn ₦500 for every friend you refer to DashSub. Share your referral code now and start earning!', type: 'promo', url: '/dashboard/referrals' },
    { title: '🔥 Flash Sale: 20% Off Data!', message: 'For the next 24 hours, enjoy 20% off all MTN data plans. Hurry, offer expires soon!', type: 'promo', url: '/dashboard/services/buy-data' },
    { title: '💸 Cashback Weekend!', message: 'Get 5% cashback on every data purchase this weekend. Offer valid Saturday & Sunday only!', type: 'promo', url: '/dashboard/services/buy-data' },
  ]},
  { category: '⚙️ System', items: [
    { title: '🔧 Scheduled Maintenance', message: 'We will be performing system maintenance on Sunday from 2AM–4AM. Services may be briefly unavailable.', type: 'warning', url: null },
    { title: '✅ Maintenance Complete', message: 'Our scheduled maintenance is complete. All services are now running smoothly. Thank you!', type: 'success', url: null },
    { title: '🔒 Security Update', message: 'We have updated our security systems to better protect your account. No action required.', type: 'info', url: null },
  ]},
];

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

export default function AdminNotifications() {
  const [title, setTitle]         = useState('');
  const [message, setMessage]     = useState('');
  const [type, setType]           = useState('info');
  const [actionUrl, setActionUrl] = useState('');
  const [sending, setSending]     = useState(false);
  const [targetMode, setTargetMode] = useState<'all' | 'multi'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers]         = useState<UserRecord[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [openCat, setOpenCat]     = useState<string | null>(null);
  const [history, setHistory]     = useState<NotifRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [histTab, setHistTab]     = useState<'all' | 'broadcast' | 'targeted'>('all');

  useEffect(() => { fetchHistory(); fetchUsers(); }, []);

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
    setUsers(data || []);
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
    setHistory(data || []);
    setLoadingHistory(false);
  }

  function applyTemplate(t: { title: string; message: string; type: string; url: string | null }) {
    setTitle(t.title); setMessage(t.message); setType(t.type); setActionUrl(t.url ?? '');
    setShowTemplates(false);
    toast.success('Template applied!');
  }

  function toggleUser(id: string) {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  }

  async function sendNotification() {
    if (!title.trim() || !message.trim()) { toast.error('Title and message required'); return; }
    if (targetMode === 'multi' && selectedUsers.length === 0) { toast.error('Select at least one user'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/admin/send-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), message: message.trim(), type,
          action_url: actionUrl.trim() || null,
          target: targetMode === 'all' ? 'all' : { user_ids: selectedUsers },
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { toast.error('Failed: ' + (result.error || 'Unknown')); return; }
      toast.success(`✅ Sent to ${result.sent_to}`);
      setTitle(''); setMessage(''); setActionUrl(''); setSelectedUsers([]);
      fetchHistory();
    } catch { toast.error('Network error'); }
    finally { setSending(false); }
  }

  async function deleteNotif(id: string) {
    setDeleting(id);
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) toast.error('Delete failed');
    else setHistory(prev => prev.filter(n => n.id !== id));
    setDeleting(null);
  }

  const filteredUsers = useMemo(() =>
    users.filter(u => (u.full_name ?? '').toLowerCase().includes(userSearch.toLowerCase())),
    [users, userSearch]);

  const filteredHistory = useMemo(() => {
    if (histTab === 'broadcast') return history.filter(n => !n.user_id);
    if (histTab === 'targeted')  return history.filter(n => !!n.user_id);
    return history;
  }, [history, histTab]);

  const selType = TYPES.find(t => t.id === type)!;

  return (
    <>
      <style>{`
        textarea:focus, input:focus { outline: none; }
        .tb { transition: all .14s; cursor: pointer; }
        .tb:hover { transform: translateY(-1px); }
        .sb { transition: all .15s; }
        .sb:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
        .ur { transition: background .12s; cursor: pointer; }
        .ur:hover { background: rgba(83,230,212,0.06) !important; }
        .tr { transition: all .13s; cursor: pointer; }
        .tr:hover { background: rgba(83,230,212,0.06) !important; border-color: rgba(83,230,212,0.2) !important; }
        .db { transition: all .13s; opacity: 0; }
        .nh:hover .db { opacity: 1; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; }
        .fs { scrollbar-width: none; }
        .fs::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ color: '#F4F7F7', fontFamily: "'Sora', sans-serif" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: '-.02em' }}>Notifications</h1>
          <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.45)' }}>Push real-time messages · {users.length} users registered</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>

          {/* LEFT: Compose */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Template picker */}
            <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
              <button onClick={() => setShowTemplates(!showTemplates)}
                style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#F4F7F7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Sparkles style={{ width: 16, height: 16, color: '#a78bfa' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Automated Templates</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontWeight: 700 }}>
                    {TEMPLATES.reduce((a, c) => a + c.items.length, 0)}
                  </span>
                </div>
                {showTemplates ? <ChevronUp style={{ width: 15, height: 15, color: 'rgba(244,247,247,0.4)' }} /> : <ChevronDown style={{ width: 15, height: 15, color: 'rgba(244,247,247,0.4)' }} />}
              </button>

              {showTemplates && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', maxHeight: 380, overflowY: 'auto' }}>
                  {TEMPLATES.map(cat => (
                    <div key={cat.category} style={{ marginBottom: 14 }}>
                      <button onClick={() => setOpenCat(openCat === cat.category ? null : cat.category)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#F4F7F7', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                        {cat.category}
                        {openCat === cat.category ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
                      </button>
                      {openCat === cat.category && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {cat.items.map((t, i) => {
                            const tc = TYPES.find(x => x.id === t.type)!;
                            const Icon = tc.icon;
                            return (
                              <button key={i} className="tr"
                                onClick={() => applyTemplate(t)}
                                style={{ padding: '10px 12px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'left', color: '#F4F7F7' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                                  <Icon style={{ width: 11, height: 11, color: tc.color }} />
                                  <span style={{ fontSize: 12, fontWeight: 700 }}>{t.title}</span>
                                </div>
                                <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.4)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                  {t.message}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compose form */}
            <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Megaphone style={{ width: 15, height: 15, color: '#53E6D4' }} /> Compose
              </h2>

              {/* Target */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 9 }}>Send To</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: 'all', label: 'All Users', icon: Users }, { id: 'multi', label: 'Select Users', icon: User }].map(({ id, label, icon: Icon }) => (
                    <button key={id} className="tb"
                      onClick={() => setTargetMode(id as any)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${targetMode === id ? 'rgba(83,230,212,0.4)' : 'rgba(255,255,255,0.08)'}`, background: targetMode === id ? 'rgba(83,230,212,0.1)' : 'transparent', color: targetMode === id ? '#53E6D4' : 'rgba(244,247,247,0.45)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <Icon style={{ width: 14, height: 14 }} />
                      {label}
                      {id === 'multi' && selectedUsers.length > 0 && (
                        <span style={{ fontSize: 10, background: '#53E6D4', color: '#0D2E2E', padding: '1px 6px', borderRadius: 7, fontWeight: 900 }}>{selectedUsers.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-user picker */}
              {targetMode === 'multi' && (
                <div style={{ marginBottom: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: 'rgba(244,247,247,0.3)' }} />
                        <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users…"
                          style={{ width: '100%', paddingLeft: 28, paddingRight: 10, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <button onClick={() => setSelectedUsers(filteredUsers.map(u => u.id))} style={{ fontSize: 11, color: '#53E6D4', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>All</button>
                      <button onClick={() => setSelectedUsers([])} style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Clear</button>
                    </div>
                    {selectedUsers.length > 0 && (
                      <p style={{ fontSize: 10, color: '#53E6D4', fontWeight: 700 }}>{selectedUsers.length} of {users.length} selected</p>
                    )}
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {filteredUsers.map(u => {
                      const checked = selectedUsers.includes(u.id);
                      return (
                        <div key={u.id} className="ur"
                          onClick={() => toggleUser(u.id)}
                          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 9, background: checked ? 'rgba(83,230,212,0.07)' : 'transparent' }}>
                          <div style={{ width: 17, height: 17, borderRadius: 4, border: `2px solid ${checked ? '#53E6D4' : 'rgba(255,255,255,0.2)'}`, background: checked ? '#53E6D4' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .12s' }}>
                            {checked && <Check style={{ width: 10, height: 10, color: '#0D2E2E' }} />}
                          </div>
                          <span style={{ fontSize: 13, color: checked ? '#F4F7F7' : 'rgba(244,247,247,0.6)', fontWeight: checked ? 700 : 400 }}>{u.full_name || 'Unnamed'}</span>
                          <span style={{ fontSize: 9, color: 'rgba(244,247,247,0.25)', marginLeft: 'auto', fontFamily: 'monospace' }}>{u.id.slice(0, 7)}…</span>
                        </div>
                      );
                    })}
                    {filteredUsers.length === 0 && <p style={{ padding: 14, fontSize: 12, color: 'rgba(244,247,247,0.3)', textAlign: 'center' }}>No users found</p>}
                  </div>
                </div>
              )}

              {/* Type */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 9 }}>Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPES.map(t => { const Icon = t.icon; return (
                    <button key={t.id} className="tb"
                      onClick={() => setType(t.id)}
                      style={{ padding: '5px 11px', borderRadius: 18, border: `1.5px solid ${type === t.id ? t.color + '55' : 'rgba(255,255,255,0.08)'}`, background: type === t.id ? t.bg : 'transparent', color: type === t.id ? t.color : 'rgba(244,247,247,0.4)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon style={{ width: 11, height: 11 }} />{t.label}
                    </button>
                  );})}
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 7 }}>Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title…" maxLength={80}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(244,247,247,0.25)', marginTop: 3 }}>{title.length}/80</div>
              </div>

              {/* Message */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 7 }}>Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your message…" rows={4} maxLength={300}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(244,247,247,0.25)', marginTop: 3 }}>{message.length}/300</div>
              </div>

              {/* URL */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 7 }}>
                  Action Link <span style={{ color: 'rgba(244,247,247,0.25)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input value={actionUrl} onChange={e => setActionUrl(e.target.value)} placeholder="/dashboard/services/buy-data"
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              {/* Preview */}
              {(title || message) && (
                <div style={{ marginBottom: 16, padding: 13, borderRadius: 11, background: selType.bg, border: `1px solid ${selType.color}33` }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: selType.color, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Preview</p>
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: selType.bg, border: `1px solid ${selType.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {(() => { const I = selType.icon; return <I style={{ width: 13, height: 13, color: selType.color }} />; })()}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#F4F7F7', marginBottom: 2 }}>{title || 'Title…'}</p>
                      <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.6)', lineHeight: 1.5 }}>{message || 'Message…'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Send */}
              <button className="sb" onClick={sendNotification} disabled={sending || !title.trim() || !message.trim()}
                style={{ width: '100%', padding: '13px', borderRadius: 13, background: !sending && title && message ? '#53E6D4' : 'rgba(255,255,255,0.06)', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', color: !sending && title && message ? '#0D2E2E' : 'rgba(244,247,247,0.3)', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: !sending && title && message ? '0 6px 24px rgba(83,230,212,0.25)' : 'none' }}>
                {sending
                  ? <><Loader2 style={{ width: 16, height: 16 }} className="spin" /> Sending…</>
                  : <><Send style={{ width: 16, height: 16 }} /> Send to {targetMode === 'all' ? 'All Users' : `${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`}</>
                }
              </button>
            </div>
          </div>

          {/* RIGHT: History */}
          <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', position: 'sticky', top: 20 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock style={{ width: 13, height: 13, color: '#53E6D4' }} /> Sent History
              </span>
              <button onClick={fetchHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(244,247,247,0.3)' }}>
                <RefreshCw style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* Tabs */}
            <div className="fs" style={{ display: 'flex', gap: 5, padding: '8px 12px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[{ id: 'all', label: 'All' }, { id: 'broadcast', label: '→ All' }, { id: 'targeted', label: '→ User' }].map(t => (
                <button key={t.id} onClick={() => setHistTab(t.id as any)}
                  style={{ padding: '4px 11px', borderRadius: 12, border: `1px solid ${histTab === t.id ? 'rgba(83,230,212,0.3)' : 'rgba(255,255,255,0.07)'}`, background: histTab === t.id ? 'rgba(83,230,212,0.1)' : 'transparent', color: histTab === t.id ? '#53E6D4' : 'rgba(244,247,247,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {loadingHistory ? (
                <div style={{ padding: '28px 0', textAlign: 'center' }}>
                  <Loader2 style={{ width: 18, height: 18, color: '#53E6D4', margin: '0 auto' }} className="spin" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div style={{ padding: '28px 0', textAlign: 'center' }}>
                  <Bell style={{ width: 22, height: 22, color: 'rgba(244,247,247,0.15)', margin: '0 auto 7px' }} />
                  <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.3)' }}>No notifications sent</p>
                </div>
              ) : (
                filteredHistory.map(n => {
                  const t = TYPES.find(x => x.id === n.type) ?? TYPES[0];
                  const Icon = t.icon;
                  return (
                    <div key={n.id} className="nh"
                      style={{ padding: '11px 13px', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
                      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <div style={{ width: 27, height: 27, borderRadius: 7, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon style={{ width: 11, height: 11, color: t.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#F4F7F7', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 22 }}>{n.title}</p>
                          <p style={{ fontSize: 10, color: 'rgba(244,247,247,0.4)', lineHeight: 1.4, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{n.message}</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: n.user_id ? 'rgba(250,204,21,0.1)' : 'rgba(83,230,212,0.1)', color: n.user_id ? '#facc15' : '#53E6D4' }}>
                              {n.user_id ? '→ User' : '→ All'}
                            </span>
                            <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.25)' }}>{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <button className="db" onClick={() => deleteNotif(n.id)} disabled={deleting === n.id}
                        style={{ position: 'absolute', top: 9, right: 9, width: 22, height: 22, borderRadius: 5, background: 'rgba(248,113,113,0.15)', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {deleting === n.id ? <Loader2 style={{ width: 9, height: 9 }} className="spin" /> : <Trash2 style={{ width: 9, height: 9 }} />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}