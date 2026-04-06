'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Bell, Send, Users, User, Megaphone,
  CheckCircle2, Clock, Trash2, Loader2,
  Info, Zap, AlertTriangle, Star, Gift,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationRecord {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

interface UserRecord {
  id: string;
  full_name: string | null;
  email?: string;
}

const TYPES = [
  { id: 'info',    label: 'Info',    icon: Info,          color: '#53E6D4', bg: 'rgba(83,230,212,0.12)'  },
  { id: 'success', label: 'Success', icon: CheckCircle2,  color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  { id: 'warning', label: 'Warning', icon: AlertTriangle, color: '#facc15', bg: 'rgba(250,204,21,0.12)'  },
  { id: 'feature', label: 'Feature', icon: Star,          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { id: 'promo',   label: 'Promo',   icon: Gift,          color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { id: 'alert',   label: 'Alert',   icon: Zap,           color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
];

export default function AdminNotifications() {
  const [title, setTitle]           = useState('');
  const [message, setMessage]       = useState('');
  const [type, setType]             = useState('info');
  const [actionUrl, setActionUrl]   = useState('');
  const [target, setTarget]         = useState<'all' | 'user'>('all');
  const [selectedUser, setSelectedUser] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers]           = useState<UserRecord[]>([]);
  const [sending, setSending]       = useState(false);
  const [history, setHistory]       = useState<NotificationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deleting, setDeleting]     = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name');
    setUsers(data || []);
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data || []);
    setLoadingHistory(false);
  }

  async function sendNotification() {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (target === 'user' && !selectedUser) {
      toast.error('Select a user to send to');
      return;
    }

    setSending(true);
    try {
      const body: any = {
        title: title.trim(),
        message: message.trim(),
        type,
        action_url: actionUrl.trim() || null,
        target: target === 'all' ? 'all' : { user_id: selectedUser },
      };

      const res = await fetch('/api/admin/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        toast.error('Failed: ' + (result.error || 'Unknown error'));
        return;
      }

      toast.success(`✅ Notification sent to ${result.sent_to}`);
      setTitle('');
      setMessage('');
      setActionUrl('');
      setSelectedUser('');
      fetchHistory();
    } catch {
      toast.error('Network error');
    } finally {
      setSending(false);
    }
  }

  async function deleteNotification(id: string) {
    setDeleting(id);
    const res = await fetch('/api/admin/update-plan', {
      method: 'DELETE',
    });
    // Use supabase directly for delete
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete');
    } else {
      setHistory(prev => prev.filter(n => n.id !== id));
      toast.success('Deleted');
    }
    setDeleting(null);
  }

  const filteredUsers = users.filter(u =>
    (u.full_name ?? '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const selectedType = TYPES.find(t => t.id === type)!;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; }
        textarea:focus, input:focus, select:focus { outline: none; }
        .type-btn { transition: all .14s; cursor: pointer; }
        .type-btn:hover { transform: translateY(-1px); }
        .send-btn { transition: all .15s; }
        .send-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
        .del-btn { transition: all .13s; opacity: 0; }
        .notif-row:hover .del-btn { opacity: 1; }
      `}</style>

      <div style={{ color: '#F4F7F7', fontFamily: "'Sora', sans-serif" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-.02em' }}>
            Notifications
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.45)', fontWeight: 500 }}>
            Push messages to all users or specific users in real-time
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

          {/* ── Compose Panel ── */}
          <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone style={{ width: 18, height: 18, color: '#53E6D4' }} />
              Compose Notification
            </h2>

            {/* Target */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 10 }}>
                Send To
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'all',  label: 'All Users',     icon: Users },
                  { id: 'user', label: 'Specific User', icon: User  },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} className="type-btn"
                    onClick={() => setTarget(id as any)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${target === id ? 'rgba(83,230,212,0.4)' : 'rgba(255,255,255,0.08)'}`, background: target === id ? 'rgba(83,230,212,0.1)' : 'transparent', color: target === id ? '#53E6D4' : 'rgba(244,247,247,0.45)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <Icon style={{ width: 15, height: 15 }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* User picker */}
            {target === 'user' && (
              <div style={{ marginBottom: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search user by name…"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
                />
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {filteredUsers.map(u => (
                    <button key={u.id}
                      onClick={() => { setSelectedUser(u.id); setUserSearch(u.full_name ?? ''); }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: selectedUser === u.id ? 'rgba(83,230,212,0.12)' : 'transparent', color: selectedUser === u.id ? '#53E6D4' : '#F4F7F7', fontSize: 13, fontWeight: selectedUser === u.id ? 700 : 400, textAlign: 'left', cursor: 'pointer', marginBottom: 2 }}>
                      {u.full_name || 'Unnamed User'}
                      <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.3)', marginLeft: 8 }}>{u.id.slice(0, 8)}…</span>
                    </button>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.3)', textAlign: 'center', padding: '12px 0' }}>No users found</p>
                  )}
                </div>
              </div>
            )}

            {/* Type */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 10 }}>
                Notification Type
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TYPES.map(t => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <button key={t.id} className="type-btn"
                      onClick={() => setType(t.id)}
                      style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${active ? t.color + '55' : 'rgba(255,255,255,0.08)'}`, background: active ? t.bg : 'transparent', color: active ? t.color : 'rgba(244,247,247,0.4)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon style={{ width: 13, height: 13 }} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 8 }}>
                Title
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. New Feature Available!"
                maxLength={80}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(244,247,247,0.25)', marginTop: 4 }}>{title.length}/80</div>
            </div>

            {/* Message */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 8 }}>
                Message
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your notification message here…"
                rows={4}
                maxLength={300}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(244,247,247,0.25)', marginTop: 4 }}>{message.length}/300</div>
            </div>

            {/* Action URL (optional) */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'block', marginBottom: 8 }}>
                Action Link <span style={{ color: 'rgba(244,247,247,0.25)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                value={actionUrl}
                onChange={e => setActionUrl(e.target.value)}
                placeholder="/dashboard/services/buy-data"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#F4F7F7', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {/* Preview */}
            {(title || message) && (
              <div style={{ marginBottom: 20, padding: 16, borderRadius: 14, background: selectedType.bg, border: `1px solid ${selectedType.color}33` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: selectedType.color, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Preview</p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: selectedType.bg, border: `1px solid ${selectedType.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(() => { const Icon = selectedType.icon; return <Icon style={{ width: 16, height: 16, color: selectedType.color }} />; })()}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#F4F7F7', marginBottom: 4 }}>{title || 'Notification Title'}</p>
                    <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.6)', lineHeight: 1.5 }}>{message || 'Your message will appear here…'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Send button */}
            <button className="send-btn"
              onClick={sendNotification}
              disabled={sending || !title.trim() || !message.trim()}
              style={{ width: '100%', padding: '14px', borderRadius: 14, background: sending || !title.trim() || !message.trim() ? 'rgba(255,255,255,0.06)' : '#53E6D4', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', color: sending || !title.trim() || !message.trim() ? 'rgba(244,247,247,0.3)' : '#0D2E2E', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: !sending && title && message ? '0 6px 24px rgba(83,230,212,0.25)' : 'none' }}>
              {sending
                ? <><Loader2 style={{ width: 17, height: 17 }} className="spin" /> Sending…</>
                : <><Send style={{ width: 17, height: 17 }} /> Send to {target === 'all' ? 'All Users' : 'User'}</>
              }
            </button>
          </div>

          {/* ── History Panel ── */}
          <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Clock style={{ width: 16, height: 16, color: '#53E6D4' }} />
                Recent Sent
              </h2>
              <span style={{ fontSize: 11, color: 'rgba(244,247,247,0.3)' }}>{history.length} total</span>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Loader2 style={{ width: 22, height: 22, color: '#53E6D4', margin: '0 auto' }} className="spin" />
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Bell style={{ width: 28, height: 28, color: 'rgba(244,247,247,0.15)', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.3)' }}>No notifications sent yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
                {history.map(n => {
                  const t = TYPES.find(x => x.id === n.type) ?? TYPES[0];
                  const Icon = t.icon;
                  return (
                    <div key={n.id} className="notif-row"
                      style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon style={{ width: 13, height: 13, color: t.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#F4F7F7', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</p>
                          <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.5)', lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: n.user_id ? 'rgba(250,204,21,0.1)' : 'rgba(83,230,212,0.1)', color: n.user_id ? '#facc15' : '#53E6D4' }}>
                              {n.user_id ? '→ User' : '→ All'}
                            </span>
                            <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.25)' }}>
                              {new Date(n.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="del-btn"
                        onClick={() => deleteNotification(n.id)}
                        disabled={deleting === n.id}
                        style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 6, background: 'rgba(248,113,113,0.15)', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {deleting === n.id
                          ? <Loader2 style={{ width: 11, height: 11 }} className="spin" />
                          : <Trash2 style={{ width: 11, height: 11 }} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}