'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { useRouter } from 'next/navigation';
import {
  Bell, X, CheckCheck, Info, CheckCircle2,
  AlertTriangle, Star, Gift, Zap, ChevronRight, ArrowRight,
} from 'lucide-react';

interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;       // for personal notifs
  _is_read?: boolean;     // computed for broadcasts
  action_url: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  info:    { color: '#53E6D4', bg: 'rgba(83,230,212,0.12)',  icon: Info          },
  success: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: CheckCircle2  },
  warning: { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  icon: AlertTriangle },
  feature: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: Star          },
  promo:   { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: Gift          },
  alert:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: Zap           },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { session } = useSupabaseSession();
  const router      = useRouter();
  const panelRef    = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);

  const unread = notifications.filter(n => !(n._is_read ?? n.is_read)).length;

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchNotifications();

    const channel = supabase
      .channel('bell_notifications_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new as Notification;
          // Only add if for this user OR broadcast
          if (!n.user_id || n.user_id === session.user.id) {
            // For broadcast, mark as unread by default
            setNotifications(prev => [{ ...n, _is_read: false }, ...prev]);
            playSound();
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [open]);

  async function fetchNotifications() {
    if (!session?.user?.id) return;
    setLoading(true);

    // Get user's registration date to filter out old broadcasts
    const userCreatedAt = session.user.created_at;

    // 1. Fetch personal notifications
    const { data: personal } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(15);

    // 2. Fetch broadcast notifications (only ones sent AFTER user registered)
    const { data: broadcasts } = await supabase
      .from('notifications')
      .select('*')
      .is('user_id', null)
      .gte('created_at', userCreatedAt) // ← KEY FIX: only show broadcasts after registration
      .order('created_at', { ascending: false })
      .limit(15);

    // 3. Fetch which broadcasts this user has already read
    const { data: readRecords } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', session.user.id);

    const readIds = new Set((readRecords || []).map(r => r.notification_id));

    // 4. Merge: mark broadcasts as read/unread based on notification_reads
    const markedBroadcasts = (broadcasts || []).map(n => ({
      ...n,
      _is_read: readIds.has(n.id), // use _is_read for broadcasts
    }));

    // 5. Combine and sort by date
    const all = [
      ...(personal || []),
      ...markedBroadcasts,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setNotifications(all.slice(0, 20));
    setLoading(false);
  }

  async function markRead(n: Notification) {
    const isBroadcast = !n.user_id;

    if (isBroadcast) {
      // Track in notification_reads table
      await supabase
        .from('notification_reads')
        .upsert({ user_id: session!.user.id, notification_id: n.id }, { onConflict: 'user_id,notification_id' });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, _is_read: true } : x));
    } else {
      // Update is_read directly on personal notification
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
  }

  async function markAllRead() {
    if (!session?.user?.id) return;
    const unreadPersonal   = notifications.filter(n => n.user_id === session.user.id && !n.is_read);
    const unreadBroadcasts = notifications.filter(n => !n.user_id && !n._is_read);

    // Mark personal ones
    if (unreadPersonal.length) {
      await supabase.from('notifications')
        .update({ is_read: true })
        .in('id', unreadPersonal.map(n => n.id));
    }

    // Mark broadcasts in reads table
    if (unreadBroadcasts.length) {
      const rows = unreadBroadcasts.map(n => ({
        user_id: session.user.id,
        notification_id: n.id,
      }));
      await supabase.from('notification_reads')
        .upsert(rows, { onConflict: 'user_id,notification_id' });
    }

    setNotifications(prev => prev.map(n => ({
      ...n,
      is_read: true,
      _is_read: true,
    })));
  }

  async function handleClick(n: Notification) {
    const isUnread = !(n._is_read ?? n.is_read);
    if (isUnread) await markRead(n);
    if (n.action_url) { router.push(n.action_url); setOpen(false); }
  }

  function playSound() {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  if (!session) return null;

  return (
    <>
      <style>{`
        @keyframes bellShake {
          0%,100%{transform:rotate(0)} 15%{transform:rotate(14deg)}
          30%{transform:rotate(-11deg)} 45%{transform:rotate(9deg)}
          60%{transform:rotate(-6deg)} 75%{transform:rotate(4deg)}
        }
        @keyframes slideDown {
          from{opacity:0;transform:translateY(-10px) scale(.97)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes badgePop { from{transform:scale(0)} to{transform:scale(1)} }
        .bell-btn { transition:all .15s; }
        .bell-btn:hover { background:rgba(83,230,212,0.12) !important; border-color:rgba(83,230,212,0.3) !important; }
        .notif-row { transition:background .12s; cursor:pointer; }
        .notif-row:hover { background:rgba(83,230,212,0.05) !important; }
        .mark-btn { transition:color .12s; cursor:pointer; }
        .mark-btn:hover { color:#53E6D4 !important; }
        .view-all { transition:background .13s; }
        .view-all:hover { background:rgba(83,230,212,0.06) !important; }
        @media (max-width: 500px) {
          .notif-panel {
            position: fixed !important; inset: 0 !important;
            width: 100vw !important; max-height: 100dvh !important;
            border-radius: 0 !important; top: 0 !important; right: 0 !important;
          }
        }
      `}</style>

      <div ref={panelRef} style={{ position: 'relative' }}>

        {/* Bell */}
        <button className="bell-btn"
          onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
          style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, background: open ? 'rgba(83,230,212,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${open ? 'rgba(83,230,212,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell style={{ width: 17, height: 17, color: open ? '#53E6D4' : 'rgba(244,247,247,0.6)', animation: unread > 0 ? 'bellShake 1.2s ease 0.5s' : 'none' }} />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: '#f87171', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', animation: 'badgePop .25s cubic-bezier(.34,1.56,.64,1)', border: '2px solid #0D2E2E' }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* Panel */}
        {open && (
          <div className="notif-panel"
            style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 360, maxHeight: 540, background: '#0D2E2E', border: '1px solid rgba(83,230,212,0.18)', borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', animation: 'slideDown .2s ease', zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell style={{ width: 15, height: 15, color: '#53E6D4' }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: '#F4F7F7' }}>Notifications</span>
                {unread > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                    {unread} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unread > 0 && (
                  <button className="mark-btn" onClick={markAllRead}
                    style={{ fontSize: 11, fontWeight: 700, color: 'rgba(244,247,247,0.4)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCheck style={{ width: 12, height: 12 }} /> All read
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(244,247,247,0.5)' }}>
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(244,247,247,0.3)', fontSize: 13 }}>Loading…</div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <Bell style={{ width: 32, height: 32, color: 'rgba(244,247,247,0.15)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(244,247,247,0.35)' }}>No notifications yet</p>
                  <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.2)', marginTop: 4 }}>You're all caught up!</p>
                </div>
              ) : (
                notifications.map(n => {
                  const isRead = n._is_read ?? n.is_read;
                  const cfg    = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                  const Icon   = cfg.icon;
                  return (
                    <div key={n.id} className="notif-row"
                      onClick={() => handleClick(n)}
                      style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 11, alignItems: 'flex-start', background: isRead ? 'transparent' : 'rgba(83,230,212,0.03)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${cfg.color}33` }}>
                        <Icon style={{ width: 14, height: 14, color: cfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                          <p style={{ fontSize: 13, fontWeight: isRead ? 600 : 800, color: isRead ? 'rgba(244,247,247,0.65)' : '#F4F7F7', lineHeight: 1.3 }}>{n.title}</p>
                          {!isRead && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#53E6D4', flexShrink: 0, marginTop: 4 }} />}
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.45)', lineHeight: 1.5, marginBottom: 5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                          {n.message}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.25)' }}>{timeAgo(n.created_at)}</span>
                          {n.action_url && <span style={{ fontSize: 10, color: '#53E6D4', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>View <ChevronRight style={{ width: 10, height: 10 }} /></span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <button className="view-all"
                onClick={() => { router.push('/dashboard/notifications'); setOpen(false); }}
                style={{ width: '100%', padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#53E6D4', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                View all notifications <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}