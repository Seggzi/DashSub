'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wifi,
  ArrowLeft,
  Wallet,
  Loader2,
  CheckCircle2,
  Sparkles,
  Zap,
  Clock,
  ChevronRight,
  Signal,
  Package,
  Flame,
  Sun,
  CalendarDays,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  reference: string;
  type: string;
  phone_number?: string;
  network?: string;
  plan_code?: string;
}

interface DataPlan {
  plan_code: string;
  plan_name: string;
  plan_amount: number;
  plan_duration: string;
}

const NETWORKS = [
  { id: '01', networkCode: '01', name: 'MTN', icon: <span className="text-3xl">📱</span>, description: 'All Plans' },
  { id: '02', networkCode: '02', name: 'Glo', icon: <span className="text-3xl">🌐</span>, description: 'All Plans' },
  { id: '04', networkCode: '04', name: 'Airtel', icon: <span className="text-3xl">📞</span>, description: 'All Plans' },
  { id: '03', networkCode: '03', name: '9mobile', icon: <span className="text-3xl">📲</span>, description: 'All Plans' },
];

function parsePlanName(planName: string) {
  const sizeMatch = planName.match(/(\d+(?:\.\d+)?)\s*(MB|GB)/i);
  const dataSize = sizeMatch ? `${sizeMatch[1]}${sizeMatch[2]}` : '';

  const durationMatch = planName.match(/(\d+)\s*(day|days)/i);
  const duration = durationMatch ? `${durationMatch[1]} ${durationMatch[2].toLowerCase() === 'day' ? 'Day' : 'Days'}` : '';

  let planType = '';
  if (planName.includes('SME')) planType = 'SME';
  else if (planName.includes('Direct Data')) planType = 'Direct';
  else if (planName.includes('Awoof Data')) planType = 'Awoof';
  else if (planName.includes('Night Plan')) planType = 'Night';
  else if (planName.includes('Weekend')) planType = 'Weekend';

  return { dataSize, duration, planType, fullName: planName };
}

function categorizePlans(plans: DataPlan[]) {
  const hot: DataPlan[] = [];
  const daily: DataPlan[] = [];
  const weekly: DataPlan[] = [];
  const monthly: DataPlan[] = [];

  plans.forEach((plan) => {
    const duration = plan.plan_duration.toLowerCase();
    if (duration.includes('1 day') || duration.includes('2 days') || duration.includes('3 days')) {
      daily.push(plan);
      if (plan.plan_amount >= 100 && plan.plan_amount <= 500) hot.push(plan);
    } else if (duration.includes('7 days') || duration.includes('14 days')) {
      weekly.push(plan);
    } else if (duration.includes('30 days') || duration.includes('60 days') || duration.includes('90 days')) {
      monthly.push(plan);
    }
  });

  return { hot, daily, weekly, monthly };
}

export default function BuyData() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [dataPlans, setDataPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [activeTab, setActiveTab] = useState<'hot' | 'daily' | 'weekly' | 'monthly'>('hot');

  const selectedNetworkData = NETWORKS.find((n) => n.id === selectedNetwork);
  const categorizedPlans = useMemo(() => categorizePlans(dataPlans), [dataPlans]);
  const displayPlans = categorizedPlans[activeTab];

  // ──────────────────────────────────────────────
  // Data Fetching
  // ──────────────────────────────────────────────

  const loadData = async () => {
    if (!session?.user?.id) return;

    const { data: walletData } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', session.user.id)
      .single();

    if (walletData) setWallet(walletData);

    const { data: transData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'data')
      .order('created_at', { ascending: false })
      .limit(5);

    if (transData) setTransactions(transData);
    setLoading(false);
  };

  const loadDataPlans = async (networkId: string) => {
    setLoadingPlans(true);
    setDataPlans([]);
    setSelectedPlan(null);

    try {
      const response = await fetch(`/api/get-data-plans?network=${networkId}`);
      if (!response.ok) throw new Error('Failed to load plans');

      const plans = await response.json();
      setDataPlans(plans);

      if (plans.length === 0) toast.info('No data plans available for this network');
    } catch {
      toast.error('Could not load data plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (sessionLoading || !session) {
      if (!session) router.push('/auth');
      return;
    }

    loadData();

    const channel = supabase
      .channel('wallet_updates_data')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${session.user.id}`,
      }, (payload) => {
        if (payload.new?.balance !== undefined) {
          setWallet({ balance: payload.new.balance as number });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (selectedNetwork) loadDataPlans(selectedNetwork);
  }, [selectedNetwork]);

  // ──────────────────────────────────────────────
  // Purchase Handler
  // ──────────────────────────────────────────────

  const handlePurchase = async () => {
    if (!phoneNumber || phoneNumber.length < 11) return toast.error('Enter a valid phone number');
    if (!selectedPlan) return toast.error('Select a data plan');

    if (!wallet || wallet.balance < selectedPlan.plan_amount) {
      return toast.error(`Insufficient balance. Need ₦${selectedPlan.plan_amount.toLocaleString()}`);
    }

    setIsPurchasing(true);

    try {
      const reference = `DATA_${Date.now()}`;

      const response = await fetch('/api/purchase-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session!.user.id,
          phoneNumber,
          network: selectedNetwork,
          networkCode: selectedNetworkData?.networkCode || selectedNetwork,
          planCode: selectedPlan.plan_code,
          reference,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${selectedPlan.plan_name} delivered successfully!`);
        setPhoneNumber('');
        setSelectedNetwork(null);
        setSelectedPlan(null);
        setDataPlans([]);
        loadData();
      } else {
        toast.error(data.message || 'Purchase failed');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-carbon flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-mint mx-auto mb-4" />
          <p className="text-brand-gray/70 text-sm">Loading your data options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-carbon text-white">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-mint/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-brand-gray/70 hover:text-brand-mint transition-colors mb-6 group text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-brand-mint to-emerald-500 rounded-2xl shadow-lg shadow-brand-mint/20">
              <Wifi className="w-7 h-7 text-brand-carbon" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Buy Data Bundle</h1>
              <p className="text-brand-gray/70 mt-1.5 text-base">Instant delivery • All networks supported</p>
            </div>
          </div>
        </header>

        {/* Wallet Card */}
        <div className="mb-10">
          <div className="bg-gradient-to-br from-brand-mint to-emerald-500 rounded-3xl p-7 shadow-xl shadow-brand-mint/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <span className="text-white/90 font-medium">Your Wallet Balance</span>
              </div>
              <Sparkles className="w-5 h-5 text-white/80 animate-pulse" />
            </div>
            <p className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              ₦{wallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </p>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-brand-primary/40 backdrop-blur-xl rounded-3xl border border-brand-mint/15 shadow-2xl p-6 sm:p-8 mb-10">
          {/* Phone Number */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-brand-gray/80 mb-3 flex items-center gap-2">
              <Signal className="w-4 h-4" />
              Recipient Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="0801 234 5678"
              maxLength={11}
              className="w-full bg-brand-carbon/60 border-2 border-brand-mint/20 rounded-2xl px-5 py-4 text-lg text-white placeholder:text-brand-gray/50 focus:outline-none focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/30 transition-all"
            />
          </div>

          {/* Network Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-brand-gray/80 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Choose Network
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {NETWORKS.map((network) => (
                <button
                  key={network.id}
                  onClick={() => setSelectedNetwork(network.id)}
                  className={`relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-300 ${
                    selectedNetwork === network.id
                      ? 'border-brand-mint bg-brand-mint/15 shadow-lg shadow-brand-mint/20 scale-[1.03]'
                      : 'border-brand-mint/20 hover:border-brand-mint/40 bg-brand-carbon/40 hover:bg-brand-carbon/60'
                  }`}
                >
                  <div className="text-4xl mb-2">{network.icon}</div>
                  <span className={`font-semibold text-sm ${selectedNetwork === network.id ? 'text-brand-mint' : 'text-white/90'}`}>
                    {network.name}
                  </span>
                  {selectedNetwork === network.id && (
                    <CheckCircle2 className="absolute -top-2 -right-2 w-6 h-6 text-brand-mint fill-brand-mint" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Plan Tabs & Grid */}
          {selectedNetwork && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Available Data Plans</h3>

              {loadingPlans ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-mint mb-4" />
                  <p className="text-brand-gray/70">Loading plans...</p>
                </div>
              ) : dataPlans.length === 0 ? (
                <div className="text-center py-16 text-brand-gray/70 bg-brand-carbon/40 rounded-2xl border border-brand-mint/10">
                  No plans available for this network
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex flex-wrap gap-2 mb-6 border-b border-brand-mint/10 pb-2">
                    {[
                      { id: 'hot', label: 'Hot Deals', icon: Flame },
                      { id: 'daily', label: 'Daily', icon: Sun },
                      { id: 'weekly', label: 'Weekly', icon: CalendarDays },
                      { id: 'monthly', label: 'Monthly', icon: Calendar },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                          activeTab === tab.id
                            ? 'bg-brand-mint text-brand-carbon shadow-md'
                            : 'bg-brand-carbon/50 text-brand-gray/80 hover:bg-brand-carbon/70'
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label} ({categorizedPlans[tab.id as keyof typeof categorizedPlans].length})
                      </button>
                    ))}
                  </div>

                  {/* Plans Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {displayPlans.map((plan) => {
                      const { dataSize, duration, planType } = parsePlanName(plan.plan_name);
                      const isSelected = selectedPlan?.plan_code === plan.plan_code;

                      return (
                        <button
                          key={plan.plan_code}
                          onClick={() => setSelectedPlan(plan)}
                          className={`p-5 rounded-2xl border transition-all duration-300 text-left ${
                            isSelected
                              ? 'border-brand-mint bg-brand-mint/10 shadow-lg shadow-brand-mint/20 scale-[1.02]'
                              : 'border-brand-mint/15 bg-brand-carbon/40 hover:border-brand-mint/40 hover:bg-brand-carbon/60'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="text-2xl font-black text-white mb-1">{dataSize || 'N/A'}</div>
                              <div className="text-sm text-brand-gray/80 mb-2">{duration || 'N/A'}</div>
                              {planType && (
                                <span className="inline-block px-3 py-1 bg-brand-mint/20 border border-brand-mint/30 rounded-full text-xs font-semibold text-brand-mint uppercase">
                                  {planType}
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className={`text-xl font-black ${isSelected ? 'text-brand-mint' : 'text-white'}`}>
                                ₦{plan.plan_amount.toLocaleString()}
                              </div>
                              {isSelected && <CheckCircle2 className="w-6 h-6 text-brand-mint fill-brand-mint mt-2 ml-auto" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Buy Button */}
          {selectedPlan && (
            <button
              onClick={handlePurchase}
              disabled={isPurchasing || !phoneNumber || phoneNumber.length < 11}
              className="w-full bg-gradient-to-r from-brand-mint to-emerald-500 text-brand-carbon font-bold text-lg py-5 rounded-2xl shadow-lg hover:shadow-xl hover:shadow-brand-mint/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6 group-hover:animate-pulse" />
                  Purchase ₦{selectedPlan.plan_amount.toLocaleString()}
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Recent Transactions */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-brand-mint/10 rounded-xl">
              <Clock className="w-5 h-5 text-brand-mint" />
            </div>
            <h3 className="text-2xl font-bold">Recent Purchases</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-brand-primary/30 border border-brand-mint/15 rounded-2xl p-12 text-center">
              <Wifi className="w-14 h-14 text-brand-mint/40 mx-auto mb-4" />
              <p className="text-brand-gray/80 text-lg font-medium">No purchases yet</p>
              <p className="text-brand-gray/60 mt-2">Your data transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => {
                const txNetwork = NETWORKS.find((n) => n.id === tx.network);
                return (
                  <div
                    key={tx.id}
                    className="bg-brand-primary/40 backdrop-blur-sm border border-brand-mint/15 rounded-2xl p-5 hover:border-brand-mint/30 transition-all"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl opacity-90">{txNetwork?.icon || '📶'}</div>
                        <div>
                          <p className="font-bold text-lg text-white">₦{tx.amount.toLocaleString()}</p>
                          <p className="text-sm text-brand-gray/70 font-mono mt-0.5">{tx.phone_number}</p>
                        </div>
                      </div>
                      <span
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                          tx.status === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-brand-gray/60 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(tx.created_at).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}