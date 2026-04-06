'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { useRouter } from 'next/navigation';
import {
  Bell, X, CheckCheck, Info, CheckCircle2,
  AlertTriangle, Star, Gift, Zap, ChevronRight,
} from 'lucide-react';

interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const { session } = useSupabaseSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchNotifications();

    // Real-time: listen for new notifications
    const channel = supabase
      .channel('user_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const n = payload.new as Notification;
        // Only add if it's for this user or broadcast
        if (!n.user_id || n.user_id === session.user.id) {
          setNotifications(prev => [n, ...prev]);
          // Show toast-like pulse
          playNotificationSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function fetchNotifications() {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${session.user.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications(data || []);
    setLoading(false);
  }

  async function markAllRead() {
    if (!session?.user?.id) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!unreadIds.length) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.is_read) await markRead(n.id);
    if (n.action_url) {
      router.push(n.action_url);
      setOpen(false);
    }
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  if (!session) return null;

  return (
    <>
      <style>{`
        @keyframes bellShake {
          0%,100%{transform:rotate(0)}
          15%{transform:rotate(15deg)}
          30%{transform:rotate(-12deg)}
          45%{transform:rotate(10deg)}
          60%{transform:rotate(-8deg)}
          75%{transform:rotate(5deg)}
        }
        @keyframes slideDown {
          from{opacity:0;transform:translateY(-8px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes badgePop {
          from{transform:scale(0)}
          to{transform:scale(1)}
        }
        .bell-icon { transition: all .15s; cursor: pointer; }
        .bell-icon:hover { color: #53E6D4 !important; }
        .notif-item { transition: background .12s; cursor: pointer; }
        .notif-item:hover { background: rgba(83,230,212,0.05) !important; }
        .mark-all { transition: color .12s; cursor: pointer; }
        .mark-all:hover { color: #53E6D4 !important; }
      `}</style>

      <div ref={panelRef} style={{ position: 'relative' }}>

        {/* Bell Button */}
        <button
          onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
          style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, background: open ? 'rgba(83,230,212,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${open ? 'rgba(83,230,212,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell
            className="bell-icon"
            style={{ width: 17, height: 17, color: open ? '#53E6D4' : 'rgba(244,247,247,0.6)', animation: unread > 0 ? 'bellShake 1s ease 0.5s' : 'none' }}
          />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: '#f87171', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', animation: 'badgePop .2s cubic-bezier(.34,1.56,.64,1)', border: '2px solid #0D2E2E' }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 360, maxHeight: 520, background: '#0D2E2E', border: '1px solid rgba(83,230,212,0.2)', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideDown .2s ease', zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell style={{ width: 16, height: 16, color: '#53E6D4' }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: '#F4F7F7' }}>Notifications</span>
                {unread > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                    {unread} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {unread > 0 && (
                  <button className="mark-all" onClick={markAllRead}
                    style={{ fontSize: 11, fontWeight: 700, color: 'rgba(244,247,247,0.4)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCheck style={{ width: 13, height: 13 }} /> Mark all read
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
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(244,247,247,0.3)', fontSize: 13 }}>
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <Bell style={{ width: 32, height: 32, color: 'rgba(244,247,247,0.15)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(244,247,247,0.35)' }}>No notifications yet</p>
                  <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.2)', marginTop: 4 }}>You're all caught up!</p>
                </div>
              ) : (
                notifications.map(n => {
                  const cfg  = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id} className="notif-item"
                      onClick={() => handleNotificationClick(n)}
                      style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 12, alignItems: 'flex-start', background: n.is_read ? 'transparent' : 'rgba(83,230,212,0.03)' }}>

                      {/* Icon */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${cfg.color}33` }}>
                        <Icon style={{ width: 15, height: 15, color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <p style={{ fontSize: 13, fontWeight: n.is_read ? 600 : 800, color: n.is_read ? 'rgba(244,247,247,0.7)' : '#F4F7F7', lineHeight: 1.3 }}>{n.title}</p>
                          {!n.is_read && (
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#53E6D4', flexShrink: 0, marginTop: 4 }} />
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.5)', lineHeight: 1.5, marginBottom: 6 }}>{n.message}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, color: 'rgba(244,247,247,0.25)' }}>{timeAgo(n.created_at)}</span>
                          {n.action_url && (
                            <span style={{ fontSize: 10, color: '#53E6D4', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                              View <ChevronRight style={{ width: 11, height: 11 }} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'rgba(244,247,247,0.25)' }}>
                  {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}