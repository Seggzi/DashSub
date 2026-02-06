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

// --- Types ---
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

// Network logos (matching airtime page)
const NETWORK_ICONS: { [key: string]: JSX.Element } = {
  mtn: <span className="text-yellow-500 font-bold text-xs">MTN</span>,
  glo: <span className="text-green-500 font-bold text-xs">GLO</span>,
  airtel: <span className="text-red-500 font-bold text-xs">AIRTEL</span>,
  '9mobile': <span className="text-emerald-400 font-bold text-xs">9M</span>,
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

  // --- State ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);

  // --- Auth & Data Fetching ---
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/auth');
      return;
    }

    const userId = session.user.id;

    async function fetchData() {
      setLoading(true);

      // Fetch wallet balance
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletData) setWallet(walletData);

      // Fetch transactions
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (error) {
        toast.error('Failed to load transactions');
      } else {
        setTransactions((prev) => (page === 1 ? data : [...prev, ...data]));
        setHasMore((data?.length || 0) === PAGE_SIZE);
      }

      setLoading(false);
    }

    fetchData();

    // Real-time subscription
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
          toast.success('New transaction added');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionLoading, router, page]);

  // --- Search & Filtering ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesFilter =
        filterType === 'all' ||
        (filterType === 'success' || filterType === 'failed' || filterType === 'pending'
          ? tx.status === filterType
          : tx.type === filterType);

      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        [tx.reference, tx.phone_number, tx.network, tx.metadata?.phone].some((field) =>
          field?.toLowerCase().includes(query)
        );

      return matchesFilter && matchesSearch;
    });
  }, [transactions, filterType, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = transactions.length;
    const successful = transactions.filter((tx) => tx.status === 'success' || tx.status === 'completed').length;
    const pending = transactions.filter((tx) => tx.status === 'pending').length;
    const failed = transactions.filter((tx) => tx.status === 'failed').length;

    return { total, successful, pending, failed };
  }, [transactions]);

  // --- Loading State ---
  if (sessionLoading || (loading && page === 1)) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-mint mx-auto mb-4" />
          <p className="text-brand-gray/60">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary text-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-mint/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto p-6 pb-24">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-brand-gray/60 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-brand-mint to-emerald-400 rounded-2xl shadow-lg shadow-brand-mint/20">
                <History className="w-6 h-6 text-brand-carbon" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Transaction History</h1>
                <p className="text-brand-gray/60 text-sm">Track all your activities</p>
              </div>
            </div>

            {/* Wallet Balance */}
            {wallet && (
              <div className="bg-brand-carbon rounded-2xl p-4 border border-white/5">
                <p className="text-xs text-brand-gray/60 mb-1">Wallet Balance</p>
                <p className="text-xl font-bold text-brand-mint">
                  ₦{wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total" value={stats.total} icon={<History className="w-4 h-4" />} color="blue" />
          <StatCard label="Successful" value={stats.successful} icon={<CheckCircle2 className="w-4 h-4" />} color="green" />
          <StatCard label="Pending" value={stats.pending} icon={<Clock className="w-4 h-4" />} color="yellow" />
          <StatCard label="Failed" value={stats.failed} icon={<XCircle className="w-4 h-4" />} color="red" />
        </div>

        {/* Search & Filters */}
        <div className="bg-brand-carbon border border-white/5 rounded-2xl p-6 mb-6">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray/60" />
            <input
              type="text"
              placeholder="Search by reference, phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-primary border-2 border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-brand-gray/50 focus:outline-none focus:border-brand-mint transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-brand-gray/60 flex-shrink-0" />
            {['all', 'deposit', 'airtime', 'data', 'success', 'pending', 'failed'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border-2 ${
                  filterType === type
                    ? 'bg-brand-mint border-brand-mint text-brand-carbon'
                    : 'bg-brand-primary border-white/5 text-brand-gray/60 hover:border-white/10'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <EmptyState searchQuery={searchQuery} />
          ) : (
            filteredTransactions.map((tx) => <TransactionCard key={tx.id} tx={tx} />)
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="w-full mt-6 py-4 bg-brand-carbon border-2 border-white/5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-white/5 hover:border-brand-mint transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Sub-Components ---

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
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border border-white/5 rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-brand-gray/60">{label}</p>
        <div className="opacity-60">{icon}</div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function TransactionCard({ tx }: { tx: Transaction }) {
  const isCredit = tx.type === 'deposit';
  const txType = TX_TYPES[tx.type] || { label: tx.type, icon: <History className="w-4 h-4" />, color: 'text-brand-gray/60' };
  const networkIcon = tx.network ? NETWORK_ICONS[tx.network] : null;

  // Status styling
  const statusStyles = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="bg-brand-carbon border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon & Details */}
        <div className="flex gap-4 flex-1">
          {/* Icon */}
          <div
            className={`p-3 ${
              isCredit ? 'bg-green-500/20' : 'bg-blue-500/20'
            } rounded-xl flex-shrink-0 group-hover:scale-110 transition-transform`}
          >
            <div className={txType.color}>{txType.icon}</div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white capitalize">{txType.label}</h3>
              {networkIcon && (
                <div className="px-2 py-0.5 bg-brand-primary rounded-full border border-white/5">{networkIcon}</div>
              )}
            </div>

            <p className="text-xs text-brand-gray/60 mb-2">
              <Calendar className="w-3 h-3 inline mr-1" />
              {new Date(tx.created_at).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>

            {tx.phone_number && (
              <p className="text-xs text-brand-gray/40">
                <Phone className="w-3 h-3 inline mr-1" />
                {tx.phone_number}
              </p>
            )}

            <p className="text-xs text-brand-gray/40 mt-1 font-mono">{tx.reference}</p>
          </div>
        </div>

        {/* Right: Amount & Status */}
        <div className="text-right flex-shrink-0">
          <p className={`text-xl font-bold mb-2 ${isCredit ? 'text-green-400' : 'text-white'}`}>
            {isCredit ? '+' : '-'}₦{tx.amount.toLocaleString()}
          </p>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              statusStyles[tx.status as keyof typeof statusStyles] || statusStyles.pending
            }`}
          >
            {tx.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="bg-brand-carbon border-2 border-dashed border-white/5 rounded-2xl p-12 text-center">
      <div className="w-20 h-20 bg-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
        <History className="w-10 h-10 text-brand-gray/60" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">
        {searchQuery ? 'No matching transactions' : 'No transactions yet'}
      </h3>
      <p className="text-brand-gray/60 mb-6">
        {searchQuery ? 'Try adjusting your search or filters' : 'Your transactions will appear here'}
      </p>
      {!searchQuery && (
        <Link
          href="/fund-wallet"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-mint to-emerald-400 text-brand-carbon rounded-xl font-bold hover:scale-105 transition-transform"
        >
          <Wallet className="w-5 h-5" />
          Fund Wallet
        </Link>
      )}
    </div>
  );
}