'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, CheckCircle2, XCircle, Info, AlertTriangle,
  ArrowLeft, Loader2, Check, Trash2, RefreshCw,
  Zap, Wallet, Phone, CreditCard,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  icon?: string;
  read: boolean;
  action_url?: string;
  created_at: string;
  category?: 'system' | 'transaction' | 'promotion';
}

export default function Notifications() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/auth');
      return;
    }

    const userId = session.user.id;

    async function fetchNotifications() {
      setLoading(true);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Notifications error:', error);
        toast.error('Failed to load notifications');
      } else {
        setNotifications(data || []);
        setUnreadCount(data?.filter(n => !n.read)?.length || 0);
      }

      setLoading(false);
    }

    fetchNotifications();

    // Real-time new notifications
    const channel = supabase
      .channel(`notifications_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(c => c + 1);
        toast.info(newNotif.title, {
          description: newNotif.message,
          action: newNotif.action_url ? {
            label: 'View',
            onClick: () => router.push(newNotif.action_url!)
          } : undefined
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionLoading, router]);

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notif.read;
    return notif.category === filter || notif.type === filter;
  });

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(c => Math.max(0, c - 1));
    }
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', session?.user.id)
      .eq('read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-mint animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-brand-carbon/80 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-xl transition">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Notifications</h1>
              <p className="text-xs text-brand-gray/60">{unreadCount} unread</p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-brand-mint/10 hover:bg-brand-mint/20 text-brand-mint rounded-xl text-sm font-medium transition flex items-center gap-2"
            >
              <Check size={16} />
              Mark all read
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'transaction', label: 'Transactions' },
            { value: 'system', label: 'System' },
            { value: 'promotion', label: 'Promotions' },
          ].map(item => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                filter === item.value
                  ? 'bg-brand-mint text-brand-carbon shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-brand-gray/80'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-brand-carbon/50 rounded-3xl p-12 text-center border border-white/5">
            <Bell size={48} className="mx-auto mb-6 text-brand-gray/30" />
            <h3 className="text-xl font-bold mb-2">All caught up!</h3>
            <p className="text-brand-gray/60">
              No {filter !== 'all' ? filter : ''} notifications yet
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`group bg-brand-carbon/60 rounded-2xl p-5 border ${
                  notif.read ? 'border-white/5' : 'border-brand-mint/30 bg-brand-mint/5'
                } hover:border-brand-mint/50 transition-all cursor-pointer`}
                onClick={() => {
                  if (!notif.read) markAsRead(notif.id);
                  if (notif.action_url) router.push(notif.action_url);
                }}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl flex-shrink-0 ${
                    notif.type === 'success' ? 'bg-green-500/20 text-green-400' :
                    notif.type === 'error' ? 'bg-red-500/20 text-red-400' :
                    notif.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {notif.type === 'success' ? <CheckCircle2 size={20} /> :
                     notif.type === 'error' ? <XCircle size={20} /> :
                     notif.type === 'warning' ? <AlertTriangle size={20} /> :
                     <Info size={20} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className={`font-semibold text-base ${
                        !notif.read ? 'text-white' : 'text-brand-gray/80'
                      }`}>
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <div className="w-2 h-2 bg-brand-mint rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>

                    <p className="text-sm text-brand-gray/80 mt-1 line-clamp-2">
                      {notif.message}
                    </p>

                    <p className="text-xs text-brand-gray/50 mt-2">
                      {new Date(notif.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {notif.action_url && (
                    <ChevronRight size={18} className="text-brand-gray/40 group-hover:text-brand-mint transition-colors flex-shrink-0 mt-1" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}