'use client';

import { useEffect, useState } from 'react';
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
  Info,
  Sparkles,
  Zap,
  TrendingUp,
  Clock,
  ChevronRight,
  Signal,
  Package,
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

const COMMISSION_RATE = 0.02;

const NETWORKS = [
  {
    id: '01',
    networkCode: '01',
    name: 'MTN',
    icon: <span className="text-4xl">📱</span>,
    darkIcon: <span className="text-4xl">📱</span>,
    description: 'All Plans'
  },
  {
    id: '02',
    networkCode: '02',
    name: 'Glo',
    icon: <span className="text-4xl">🌐</span>,
    darkIcon: <span className="text-4xl">🌐</span>,
    description: 'All Plans'
  },
  {
    id: '04',
    networkCode: '04',
    name: 'Airtel',
    icon: <span className="text-4xl">📞</span>,
    darkIcon: <span className="text-4xl">📞</span>,
    description: 'All Plans'
  },
  {
    id: '03',
    networkCode: '03',
    name: '9mobile',
    icon: <span className="text-4xl">📲</span>,
    darkIcon: <span className="text-4xl">📲</span>,
    description: 'All Plans'
  },
];

const calculateCommission = (amount: number): number => {
  return Math.ceil(amount * COMMISSION_RATE);
};

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

  const commission = selectedPlan ? calculateCommission(selectedPlan.plan_amount) : 0;
  const totalCharge = selectedPlan ? selectedPlan.plan_amount + commission : 0;

  const selectedNetworkData = NETWORKS.find((n) => n.id === selectedNetwork);

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
      console.log('🔍 Loading plans for network:', networkId);

      const response = await fetch(`/api/get-data-plans?network=${networkId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data plans');
      }

      const plans = await response.json();
      console.log('✅ Loaded plans:', plans.length);

      setDataPlans(plans);

      if (plans.length === 0) {
        toast.info('No data plans available for this network');
      }
    } catch (error: any) {
      console.error('❌ Error loading data plans:', error);
      toast.error('Failed to load data plans: ' + error.message);
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;

    if (!session) {
      router.push('/auth');
      return;
    }

    loadData();

    const channel = supabase
      .channel('wallet_updates_data')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          if (payload.new && 'balance' in payload.new) {
            setWallet({ balance: payload.new.balance as number });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (selectedNetwork) {
      loadDataPlans(selectedNetwork);
    }
  }, [selectedNetwork]);

  const handlePurchase = async () => {
    if (!phoneNumber || phoneNumber.length < 11) {
      toast.error('Please enter a valid phone number');
      return;
    }

    if (!selectedNetwork) {
      toast.error('Please select a network');
      return;
    }

    if (!selectedPlan) {
      toast.error('Please select a data plan');
      return;
    }

    if (!wallet || wallet.balance < totalCharge) {
      toast.error(`Insufficient balance. You need ₦${totalCharge.toLocaleString()}`);
      return;
    }

    setIsPurchasing(true);

    try {
      const reference = `DATA_${Date.now()}`;

      console.log('🚀 Purchasing data:', {
        userId: session!.user.id,
        phoneNumber,
        network: selectedNetwork,
        networkCode: selectedNetworkData?.networkCode,
        planCode: selectedPlan.plan_code,
        amount: selectedPlan.plan_amount,
        reference,
      });

      const response = await fetch('/api/purchase-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session!.user.id,
          phoneNumber: phoneNumber,
          network: selectedNetwork,
          networkCode: selectedNetworkData?.networkCode || selectedNetwork,
          planCode: selectedPlan.plan_code,
          amount: selectedPlan.plan_amount,
          reference: reference,
        }),
      });

      const data = await response.json();
      console.log('API Response:', data);

      if (data.success) {
        toast.success(`${selectedPlan.plan_name} sent successfully! 🎉`);
        setPhoneNumber('');
        setSelectedNetwork(null);
        setSelectedPlan(null);
        setDataPlans([]);
        loadData();
      } else {
        toast.error(data.message || 'Purchase failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast.error('An error occurred. Please contact support.');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-carbon flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-mint mx-auto mb-4" />
          <p className="text-brand-gray/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-carbon text-white relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-mint/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-2xl mx-auto p-6 pb-20">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-brand-gray/60 hover:text-brand-mint transition-colors mb-6 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-brand-mint to-brand-mint/80 rounded-2xl shadow-lg shadow-brand-mint/20">
              <Wifi className="w-6 h-6 text-brand-carbon" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Buy Data</h1>
              <p className="text-brand-gray/60 text-sm mt-1">Fast delivery • All networks</p>
            </div>
          </div>
        </div>

        {/* Wallet Balance */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-brand-mint to-brand-mint/80 rounded-3xl p-6 shadow-2xl shadow-brand-mint/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-carbon/20 backdrop-blur-sm rounded-xl">
                  <Wallet className="w-5 h-5 text-brand-carbon" />
                </div>
                <span className="text-brand-carbon/80 text-sm font-medium">Wallet Balance</span>
              </div>
              <Sparkles className="w-5 h-5 text-brand-carbon/60 animate-pulse" />
            </div>
            <span className="text-4xl font-black text-brand-carbon">
              ₦{wallet?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
        </div>

        {/* Purchase Form */}
        <div className="bg-brand-primary/30 backdrop-blur-xl rounded-3xl p-6 border border-brand-mint/10 shadow-2xl mb-8">
          {/* Phone Number */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-brand-gray/80 mb-3 flex items-center gap-2">
              <Signal className="w-4 h-4" />
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0801 234 5678"
              maxLength={11}
              className="w-full bg-brand-carbon/50 border-2 border-brand-mint/20 rounded-2xl px-5 py-4 text-white text-lg placeholder:text-brand-gray/40 focus:outline-none focus:border-brand-mint transition-all"
            />
          </div>

          {/* Network Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-brand-gray/80 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Select Network
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {NETWORKS.map((network) => (
                <button
                  key={network.id}
                  onClick={() => setSelectedNetwork(network.id)}
                  className={`relative p-4 rounded-2xl border-2 transition-all ${
                    selectedNetwork === network.id
                      ? 'border-brand-mint bg-brand-mint/10 scale-105 shadow-lg shadow-brand-mint/20'
                      : 'border-brand-mint/20 bg-brand-carbon/30 hover:border-brand-mint/40 hover:scale-105'
                  }`}
                >
                  <div className="mb-2">{network.darkIcon}</div>
                  <p
                    className={`text-sm font-bold ${
                      selectedNetwork === network.id ? 'text-brand-mint' : 'text-brand-gray/60'
                    }`}
                  >
                    {network.name}
                  </p>
                  {selectedNetwork === network.id && (
                    <div className="absolute -top-1 -right-1">
                      <CheckCircle2 className="w-5 h-5 text-brand-mint fill-brand-mint" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Data Plans */}
          {selectedNetwork && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-brand-gray/80 mb-3">Select Data Plan</label>

              {loadingPlans ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-mint" />
                </div>
              ) : dataPlans.length === 0 ? (
                <div className="text-center py-12 text-brand-gray/60">No data plans available</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2">
                  {dataPlans.map((plan) => (
                    <button
                      key={plan.plan_code}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        selectedPlan?.plan_code === plan.plan_code
                          ? 'border-brand-mint bg-brand-mint/10 shadow-lg'
                          : 'border-brand-mint/20 bg-brand-carbon/30 hover:border-brand-mint/40'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white">{plan.plan_name}</p>
                          <p className="text-sm text-brand-gray/60 mt-1">{plan.plan_duration}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-brand-mint text-lg">
                            ₦{plan.plan_amount.toLocaleString()}
                          </p>
                          {selectedPlan?.plan_code === plan.plan_code && (
                            <CheckCircle2 className="w-5 h-5 text-brand-mint fill-brand-mint mt-1" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Price Breakdown */}
          {selectedPlan && (
            <div className="mb-6 p-5 bg-brand-carbon/50 rounded-2xl border border-brand-mint/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-brand-mint/10 rounded-lg">
                  <Info className="w-4 h-4 text-brand-mint" />
                </div>
                <p className="text-sm font-bold text-brand-mint">Price Breakdown</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-brand-gray/60 text-sm">Data Plan</span>
                  <span className="font-bold text-white text-lg">
                    ₦{selectedPlan.plan_amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-brand-gray/60 text-sm">Service Fee (2%)</span>
                  <span className="font-semibold text-brand-gray">₦{commission.toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t border-brand-mint/20 flex justify-between items-center">
                  <span className="text-brand-mint font-bold">Total</span>
                  <span className="text-brand-mint font-black text-2xl">
                    ₦{totalCharge.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Button */}
          <button
            onClick={handlePurchase}
            disabled={isPurchasing || !phoneNumber || !selectedNetwork || !selectedPlan}
            className="w-full bg-gradient-to-r from-brand-mint to-brand-mint/80 text-brand-carbon font-black text-lg py-5 rounded-2xl hover:shadow-2xl hover:shadow-brand-mint/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group hover:scale-[1.02] active:scale-[0.98]"
          >
            {isPurchasing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-6 h-6 group-hover:animate-pulse" />
                Purchase for ₦{totalCharge.toLocaleString()}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-brand-primary/30 rounded-xl">
              <Clock className="w-5 h-5 text-brand-mint" />
            </div>
            <h3 className="text-xl font-bold">Recent Purchases</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-brand-primary/20 border-2 border-dashed border-brand-mint/20 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-brand-carbon/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wifi className="w-10 h-10 text-brand-mint/50" />
              </div>
              <p className="text-brand-gray font-medium">No purchase history yet</p>
              <p className="text-brand-gray/60 text-sm mt-1">Your transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const txNetwork = NETWORKS.find((n) => n.id === tx.network);
                return (
                  <div
                    key={tx.id}
                    className="bg-brand-primary/30 backdrop-blur-xl border border-brand-mint/10 rounded-2xl p-5 hover:border-brand-mint/30 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div>{txNetwork?.darkIcon || '📶'}</div>
                        <div>
                          <p className="font-bold text-white text-lg">₦{tx.amount.toLocaleString()}</p>
                          <p className="text-sm text-brand-gray/60 font-mono">{tx.phone_number}</p>
                          <p className="text-xs text-brand-gray/50 mt-1">{tx.plan_code}</p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase ${
                          tx.status === 'completed' || tx.status === 'success'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : tx.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-brand-gray/50">
                      <Clock className="w-3 h-3" />
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}