'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, CheckCircle2, AlertTriangle, Info,
  ArrowLeft, Loader2, Check, Star, Gift, Zap,
  ChevronRight, Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  _is_read?: boolean;  // computed read state for broadcasts
  action_url: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
  info:    { color: '#53E6D4', bg: 'rgba(83,230,212,0.10)',  border: 'rgba(83,230,212,0.2)',  icon: Info,          label: 'Info'    },
  success: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.2)',  icon: CheckCircle2,  label: 'Success' },
  warning: { color: '#facc15', bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.2)',  icon: AlertTriangle, label: 'Warning' },
  feature: { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.2)', icon: Star,          label: 'Feature' },
  promo:   { color: '#fb923c', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.2)',  icon: Gift,          label: 'Promo'   },
  alert:   { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.2)', icon: Zap,           label: 'Alert'   },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

const FILTERS = [
  { id: 'all',     label: 'All'      },
  { id: 'unread',  label: 'Unread'   },
  { id: 'info',    label: 'Info'     },
  { id: 'success', label: 'Success'  },
  { id: 'promo',   label: 'Promos'   },
  { id: 'feature', label: 'Features' },
  { id: 'warning', label: 'Warnings' },
];

export default function NotificationsPage() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState('all');
  const [expanded, setExpanded]           = useState<string | null>(null);
  const [markingAll, setMarkingAll]       = useState(false);

  const getIsRead = (n: Notification) => n._is_read ?? n.is_read;
  const unreadCount = notifications.filter(n => !getIsRead(n)).length;

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    fetchNotifications();

    const channel = supabase
      .channel('notifications_page_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new as Notification;
          if (!n.user_id || n.user_id === session.user.id) {
            setNotifications(prev => [{ ...n, _is_read: false }, ...prev]);
            toast.info(n.title, { description: n.message });
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, sessionLoading, router]);

  async function fetchNotifications() {
    if (!session?.user?.id) return;
    setLoading(true);

    const userCreatedAt = session.user.created_at;

    // Personal notifications
    const { data: personal } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    // Broadcasts only after user registered
    const { data: broadcasts } = await supabase
      .from('notifications')
      .select('*')
      .is('user_id', null)
      .gte('created_at', userCreatedAt)
      .order('created_at', { ascending: false });

    // Which broadcasts has this user read?
    const { data: readRecords } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', session.user.id);

    const readIds = new Set((readRecords || []).map(r => r.notification_id));

    const markedBroadcasts = (broadcasts || []).map(n => ({
      ...n,
      _is_read: readIds.has(n.id),
    }));

    const all = [...(personal || []), ...markedBroadcasts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setNotifications(all);
    setLoading(false);
  }

  async function markRead(n: Notification) {
    const isBroadcast = !n.user_id;
    if (isBroadcast) {
      await supabase.from('notification_reads')
        .upsert({ user_id: session!.user.id, notification_id: n.id }, { onConflict: 'user_id,notification_id' });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, _is_read: true } : x));
    } else {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
  }

  async function markAllRead() {
    if (!session?.user?.id) return;
    setMarkingAll(true);

    const unreadPersonal   = notifications.filter(n => n.user_id === session.user.id && !n.is_read);
    const unreadBroadcasts = notifications.filter(n => !n.user_id && !n._is_read);

    if (unreadPersonal.length) {
      await supabase.from('notifications')
        .update({ is_read: true })
        .in('id', unreadPersonal.map(n => n.id));
    }

    if (unreadBroadcasts.length) {
      await supabase.from('notification_reads')
        .upsert(
          unreadBroadcasts.map(n => ({ user_id: session.user.id, notification_id: n.id })),
          { onConflict: 'user_id,notification_id' }
        );
    }

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, _is_read: true })));
    setMarkingAll(false);
    toast.success('All marked as read');
  }

  async function handleOpen(n: Notification) {
    setExpanded(expanded === n.id ? null : n.id);
    if (!getIsRead(n)) await markRead(n);
  }

  const filtered = notifications.filter(n => {
    if (filter === 'all')    return true;
    if (filter === 'unread') return !getIsRead(n);
    return n.type === filter;
  });

  if (sessionLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#0D2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 style={{ width: 32, height: 32, color: '#53E6D4', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --primary:#0D2E2E; --carbon:#080C0C; --mint:#53E6D4; --gray:#F4F7F7; --font:'Sora',sans-serif; }
        body { background:var(--primary); font-family:var(--font); -webkit-font-smoothing:antialiased; }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .filter-btn { transition:all .14s; white-space:nowrap; }
        .filter-btn:hover { transform:translateY(-1px); }
        .notif-card { transition:all .15s; cursor:pointer; }
        .notif-card:hover { border-color:rgba(83,230,212,0.25) !important; background:rgba(83,230,212,0.03) !important; }
        .mark-btn { transition:all .13s; }
        .mark-btn:hover { background:rgba(83,230,212,0.15) !important; }
        .filters-scroll { scrollbar-width:none; -ms-overflow-style:none; }
        .filters-scroll::-webkit-scrollbar { display:none; }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)', fontFamily: 'var(--font)' }}>

        {/* Header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link href="/dashboard"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(244,247,247,0.6)', textDecoration: 'none', flexShrink: 0 }}>
                <ArrowLeft style={{ width: 17, height: 17 }} />
              </Link>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>Notifications</h1>
                <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.4)', fontWeight: 500 }}>
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button className="mark-btn"
                onClick={markAllRead} disabled={markingAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'rgba(83,230,212,0.1)', border: '1px solid rgba(83,230,212,0.2)', color: '#53E6D4', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                {markingAll ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: 13, height: 13 }} />}
                Read all
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="filters-scroll" style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', maxWidth: 680, margin: '0 auto' }}>
            {FILTERS.map(f => {
              const active = filter === f.id;
              const cfg    = TYPE_CONFIG[f.id];
              return (
                <button key={f.id} className="filter-btn"
                  onClick={() => setFilter(f.id)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${active ? (cfg?.border ?? 'rgba(83,230,212,0.4)') : 'rgba(255,255,255,0.08)'}`, background: active ? (cfg?.bg ?? 'rgba(83,230,212,0.12)') : 'transparent', color: active ? (cfg?.color ?? '#53E6D4') : 'rgba(244,247,247,0.45)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {f.label}
                  {f.id === 'unread' && unreadCount > 0 && (
                    <span style={{ marginLeft: 5, fontSize: 10, background: '#f87171', color: '#fff', padding: '1px 5px', borderRadius: 8, fontWeight: 800 }}>{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* Content */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 80px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', animation: 'fadeUp .3s ease' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Bell style={{ width: 28, height: 28, color: 'rgba(244,247,247,0.2)' }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(244,247,247,0.5)', marginBottom: 6 }}>
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.25)' }}>
                {filter !== 'all' ? 'Try switching to "All"' : "You'll see messages here"}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((n, i) => {
                const isRead   = getIsRead(n);
                const cfg      = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                const Icon     = cfg.icon;
                const isOpen   = expanded === n.id;

                return (
                  <div key={n.id} className="notif-card"
                    onClick={() => handleOpen(n)}
                    style={{ borderRadius: 16, border: `1px solid ${!isRead ? cfg.border : 'rgba(255,255,255,0.06)'}`, background: !isRead ? cfg.bg : 'rgba(8,12,12,0.5)', overflow: 'hidden', animation: `fadeUp .25s ease ${i * 0.03}s both` }}>

                    <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 17, height: 17, color: cfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <p style={{ fontSize: 14, fontWeight: !isRead ? 800 : 600, color: !isRead ? '#F4F7F7' : 'rgba(244,247,247,0.75)', lineHeight: 1.3, flex: 1 }}>
                            {n.title}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {!isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#53E6D4', marginTop: 3 }} />}
                            <ChevronRight style={{ width: 14, height: 14, color: 'rgba(244,247,247,0.3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                          </div>
                        </div>

                        {!isOpen && (
                          <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.5)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                            {n.message}
                          </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: isOpen ? 0 : 6 }}>
                          <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.3)' }}>{timeAgo(n.created_at)}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`, textTransform: 'uppercase' }}>
                            {cfg.label}
                          </span>
                          {!n.user_id && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(83,230,212,0.08)', color: 'rgba(83,230,212,0.6)', border: '1px solid rgba(83,230,212,0.15)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Megaphone style={{ width: 8, height: 8 }} /> Broadcast
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0 16px 16px 68px', animation: 'fadeUp .2s ease' }}>
                        <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.65)', lineHeight: 1.7, marginBottom: 12 }}>
                          {n.message}
                        </p>
                        {n.action_url && (
                          <Link href={n.action_url}
                            onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.color}44`, color: cfg.color, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                            View Details <ChevronRight style={{ width: 13, height: 13 }} />
                          </Link>
                        )}
                        <p style={{ fontSize: 10, color: 'rgba(244,247,247,0.2)', marginTop: 10 }}>
                          {new Date(n.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}