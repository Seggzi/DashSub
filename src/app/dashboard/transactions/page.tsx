'use client';

import { useEffect, useState, useMemo, JSX } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  History,
  Wallet,
  Loader2,
  Search,
  Phone,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Filter,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';


interface Transaction {
  id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending' | 'completed';
  created_at: string;
  reference: string;
  type: 'deposit' | 'airtime' | 'data' | string;
  phone_number?: string;
  network?: string;
  metadata?: any;
}

const PAGE_SIZE = 20;


const NETWORK_STYLES: { [key: string]: { border: string; text: string; bg: string } } = {
  mtn: {
    border: 'border-yellow-500/40',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  glo: {
    border: 'border-green-500/40',
    text: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  airtel: {
    border: 'border-red-500/40',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  '9mobile': {
    border: 'border-emerald-400/40',
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
};

// Fallback for unknown networks
const DEFAULT_NETWORK_STYLE = {
  border: 'border-gray-500/40',
  text: 'text-gray-400',
  bg: 'bg-gray-500/10',
};

// Transaction type metadata
const TX_TYPES: { [key: string]: { label: string; icon: JSX.Element; color: string } } = {
  deposit: { label: 'Deposit', icon: <ArrowDownLeft className="w-4 h-4" />, color: 'text-green-400' },
  airtime: { label: 'Airtime', icon: <Phone className="w-4 h-4" />, color: 'text-blue-400' },
  data: { label: 'Data', icon: <Sparkles className="w-4 h-4" />, color: 'text-purple-400' },
  withdrawal: { label: 'Withdrawal', icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-orange-400' },
};

export default function Transactions() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);

  // ──────────────────────────────────────────────
  // Data Fetching
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/auth');
      return;
    }

    const userId = session.user.id;

    const fetchData = async () => {
      setLoading(true);

      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletData) setWallet(walletData);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (error) {
        toast.error('Failed to load transactions');
      } else {
        setTransactions((prev) => (page === 1 ? data || [] : [...prev, ...(data || [])]));
        setHasMore((data?.length || 0) === PAGE_SIZE);
      }

      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel(`user_tx_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setTransactions((prev) => [payload.new as Transaction, ...prev]);
          toast.success('New transaction received');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionLoading, router, page]);

  // ──────────────────────────────────────────────
  // Filtering & Stats
  // ──────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesFilter =
        filterType === 'all' ||
        (['success', 'failed', 'pending'].includes(filterType)
          ? tx.status === filterType
          : tx.type === filterType);

      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesFilter;

      return (
        matchesFilter &&
        [
          tx.reference?.toLowerCase(),
          tx.phone_number?.toLowerCase(),
          tx.network?.toLowerCase(),
          tx.metadata?.phone?.toLowerCase(),
        ].some((field) => field?.includes(query))
      );
    });
  }, [transactions, filterType, searchQuery]);

  const stats = useMemo(() => {
    const total = transactions.length;
    const successful = transactions.filter((tx) => tx.status === 'success' || tx.status === 'completed').length;
    const pending = transactions.filter((tx) => tx.status === 'pending').length;
    const failed = transactions.filter((tx) => tx.status === 'failed').length;

    return { total, successful, pending, failed };
  }, [transactions]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  if (sessionLoading || (loading && page === 1)) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-brand-mint mx-auto" />
          <p className="text-brand-gray/70">Loading your transaction history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary text-white relative overflow-hidden">
      {/* Subtle background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-80 h-80 sm:w-96 sm:h-96 bg-brand-mint/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 sm:w-96 sm:h-96 bg-brand-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Header */}
        <header className="mb-8 sm:mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-brand-gray/70 hover:text-white transition-colors mb-6 group text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-gradient-to-br from-brand-mint to-emerald-500 rounded-2xl shadow-lg shadow-brand-mint/20">
                <History className="w-7 h-7 text-brand-carbon" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Transaction History</h1>
                <p className="text-brand-gray/70 mt-1.5">View and track all your activities</p>
              </div>
            </div>

            {wallet && (
              <div className="bg-brand-carbon/80 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4 sm:min-w-[220px]">
                <p className="text-xs text-brand-gray/70 mb-1">Wallet Balance</p>
                <p className="text-2xl sm:text-3xl font-bold text-brand-mint">
                  ₦{wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total" value={stats.total} icon={<History className="w-5 h-5" />} color="blue" />
          <StatCard label="Successful" value={stats.successful} icon={<CheckCircle2 className="w-5 h-5" />} color="green" />
          <StatCard label="Pending" value={stats.pending} icon={<Clock className="w-5 h-5" />} color="yellow" />
          <StatCard label="Failed" value={stats.failed} icon={<XCircle className="w-5 h-5" />} color="red" />
        </div>

        {/* Search & Filters */}
        <div className="bg-brand-carbon/70 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 mb-8">
          <div className="relative mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray/60" />
            <input
              type="text"
              placeholder="Search reference, phone, network..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-primary/60 border-2 border-white/10 rounded-xl pl-12 pr-5 py-3.5 text-white placeholder:text-brand-gray/50 focus:outline-none focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Filter className="w-4 h-4 text-brand-gray/70 flex-shrink-0" />
            {['all', 'deposit', 'airtime', 'data', 'success', 'pending', 'failed'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap border-2 flex-shrink-0 ${
                  filterType === type
                    ? 'bg-brand-mint border-brand-mint text-brand-carbon shadow-sm'
                    : 'bg-transparent border-white/10 text-brand-gray/70 hover:border-white/30 hover:bg-white/5'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <EmptyState searchQuery={searchQuery} />
          ) : (
            filteredTransactions.map((tx) => <TransactionCard key={tx.id} tx={tx} />)
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-carbon border-2 border-white/10 rounded-2xl text-sm font-bold uppercase tracking-wider hover:bg-white/5 hover:border-brand-mint transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Reusable Components
// ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: JSX.Element;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    blue: 'from-blue-500/15 to-blue-600/15 border-blue-500/20 text-blue-400',
    green: 'from-green-500/15 to-green-600/15 border-green-500/20 text-green-400',
    yellow: 'from-yellow-500/15 to-yellow-600/15 border-yellow-500/20 text-yellow-400',
    red: 'from-red-500/15 to-red-600/15 border-red-500/20 text-red-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 sm:p-6 text-center shadow-sm`}>
      <div className="flex flex-col items-center gap-2">
        <div className="opacity-80">{icon}</div>
        <p className="text-xs sm:text-sm text-brand-gray/70 font-medium">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function TransactionCard({ tx }: { tx: Transaction }) {
  const isCredit = tx.type === 'deposit';
  const txType = TX_TYPES[tx.type] || { label: tx.type, icon: <History className="w-5 h-5" />, color: 'text-brand-gray/60' };

  const networkStyle = tx.network ? NETWORK_STYLES[tx.network] || DEFAULT_NETWORK_STYLE : DEFAULT_NETWORK_STYLE;

  const statusStyles = {
    success: 'bg-green-500/15 text-green-400 border-green-500/20',
    completed: 'bg-green-500/15 text-green-400 border-green-500/20',
    pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  };

  return (
    <div className="bg-brand-carbon/70 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-white/20 transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Left: Icon + Details */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Transaction Icon */}
          <div
            className={`p-3.5 rounded-xl flex-shrink-0 ${
              isCredit ? 'bg-green-500/15' : 'bg-blue-500/15'
            }`}
          >
            <div className={txType.color}>{txType.icon}</div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <h3 className="font-semibold text-white capitalize text-base sm:text-lg">
                {txType.label}
              </h3>

              {tx.network && (
                <div
                  className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ${networkStyle.border} ${networkStyle.text} ${networkStyle.bg}`}
                >
                  {tx.network.toUpperCase()}
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-brand-gray/70 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              {new Date(tx.created_at).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>

            {tx.phone_number && (
              <p className="text-xs sm:text-sm text-brand-gray/60 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                {tx.phone_number}
              </p>
            )}

            <p className="text-xs text-brand-gray/50 font-mono mt-2 break-all">
              Ref: {tx.reference}
            </p>
          </div>
        </div>

        {/* Right: Amount + Status */}
        <div className="text-right flex-shrink-0 min-w-[120px]">
          <p
            className={`text-xl sm:text-2xl font-bold mb-2 ${
              isCredit ? 'text-green-400' : 'text-white'
            }`}
          >
            {isCredit ? '+' : '-'}₦{tx.amount.toLocaleString()}
          </p>

          <span
            className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
              statusStyles[tx.status as keyof typeof statusStyles] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
            }`}
          >
            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="bg-brand-carbon/50 border-2 border-dashed border-white/10 rounded-3xl p-12 text-center">
      <div className="w-20 h-20 bg-brand-primary/40 rounded-full flex items-center justify-center mx-auto mb-6">
        <History className="w-10 h-10 text-brand-gray/60" />
      </div>

      <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3">
        {searchQuery ? 'No matching transactions found' : 'No transactions yet'}
      </h3>

      <p className="text-brand-gray/70 max-w-md mx-auto">
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Your transaction history will appear here once you start using the platform'}
      </p>

      {!searchQuery && (
        <Link
          href="/fund-wallet"
          className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-mint to-emerald-500 text-brand-carbon font-bold rounded-2xl hover:shadow-lg hover:shadow-brand-mint/20 transition-all"
        >
          <Wallet className="w-5 h-5" />
          Fund Wallet Now
        </Link>
      )}
    </div>
  );
}