'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
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
}

// Commission rate (2%)
const COMMISSION_RATE = 0.02;

// Network providers – now using real logo images
const NETWORKS = [
  { 
    id: 'mtn', 
    name: 'MTN', 
    color: 'from-yellow-400 to-yellow-600',
    textColor: 'text-yellow-600',
    bgHover: 'hover:bg-yellow-50',
    icon: <img src="/icons/mtn-logo.png" alt="MTN" className="w-10 h-10 object-contain" />,
    darkIcon: <img src="/icons/mtn-logo.png" alt="MTN" className="w-10 h-10 object-contain" />,
  },
  { 
    id: 'glo', 
    name: 'Glo', 
    color: 'from-green-400 to-green-600',
    textColor: 'text-green-600',
    bgHover: 'hover:bg-green-50',
    icon: <img src="/icons/glo-logo.png" alt="Glo" className="w-10 h-10 object-contain" />,
    darkIcon: <img src="/icons/glo-logo.png" alt="Glo" className="w-10 h-10 object-contain" />,
  },
  { 
    id: 'airtel', 
    name: 'Airtel', 
    color: 'from-red-400 to-red-600',
    textColor: 'text-red-600',
    bgHover: 'hover:bg-red-50',
    icon: <img src="/icons/airtel-logo.png" alt="Airtel" className="w-10 h-10 object-contain" />,
    darkIcon: <img src="/icons/airtel-logo.png" alt="Airtel" className="w-10 h-10 object-contain" />,
  },
  { 
    id: '9mobile', 
    name: '9mobile', 
    color: 'from-emerald-400 to-emerald-600',
    textColor: 'text-emerald-400',
    bgHover: 'hover:bg-emerald-50',
    icon: <img src="/icons/9mobile-logo.png" alt="9mobile" className="w-10 h-10 object-contain" />,
    darkIcon: <img src="/icons/9mobile-logo.png" alt="9mobile" className="w-10 h-10 object-contain" />,
  },
];

// Calculate commission
const calculateCommission = (amount: number): number => {
  return Math.ceil(amount * COMMISSION_RATE);
};

// Detect network from phone number
const detectNetwork = (phone: string): string | null => {
  const cleaned = phone.replace(/\D/g, '');

  if (/^(0703|0706|0803|0806|0810|0813|0814|0816|0903|0906|0913|0916)/.test(cleaned)) {
    return 'mtn';
  }
  if (/^(0705|0805|0807|0811|0815|0905|0915)/.test(cleaned)) {
    return 'glo';
  }
  if (/^(0701|0708|0802|0808|0812|0901|0902|0904|0907|0912)/.test(cleaned)) {
    return 'airtel';
  }
  if (/^(0809|0817|0818|0908|0909)/.test(cleaned)) {
    return '9mobile';
  }

  return null;
};

export default function BuyAirtime() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const numAmount = Number(amount) || 0;
  const commission = numAmount > 0 ? calculateCommission(numAmount) : 0;
  const totalCharge = numAmount + commission;

  const selectedNetworkData = NETWORKS.find(n => n.id === selectedNetwork);

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
      .eq('type', 'airtime')
      .order('created_at', { ascending: false })
      .limit(5);

    if (transData) setTransactions(transData);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionLoading) return;

    if (!session) {
      router.push('/auth');
      return;
    }

    loadData();

    const channel = supabase
      .channel('wallet_updates_airtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${session.user.id}`
      }, (payload) => {
        if (payload.new && 'balance' in payload.new) {
          setWallet({ balance: payload.new.balance as number });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (phoneNumber.length >= 4) {
      const network = detectNetwork(phoneNumber);
      if (network) {
        setSelectedNetwork(network);
      }
    }
  }, [phoneNumber]);

  const handlePurchase = async () => {
    if (!phoneNumber || phoneNumber.length < 11) {
      toast.error('Please enter a valid phone number');
      return;
    }

    if (!numAmount || numAmount < 50) {
      toast.error('Minimum airtime amount is ₦50');
      return;
    }

    if (!selectedNetwork) {
      toast.error('Please select a network');
      return;
    }

    if (!wallet || wallet.balance < totalCharge) {
      toast.error(`Insufficient balance. You need ₦${totalCharge.toLocaleString()}`);
      return;
    }

    setIsPurchasing(true);

    try {
      const reference = `AIRTIME_${Date.now()}`;

      const response = await fetch('/api/purchase-airtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session!.user.id,
          phoneNumber: phoneNumber,
          amount: numAmount,
          network: selectedNetwork,
          reference: reference,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`₦${numAmount} airtime sent successfully! 🎉`);
        setPhoneNumber('');
        setAmount('');
        setSelectedNetwork(null);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-mint mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-mint/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto p-6 pb-20">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-brand-mint to-emerald-500 rounded-2xl shadow-lg shadow-brand-mint/20">
              <Phone className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Buy Airtime
              </h1>
              <p className="text-slate-400 text-sm mt-1">Instant top-up • All networks</p>
            </div>
          </div>
        </div>

        {/* Wallet Balance Card */}
        <div className="mb-8 group cursor-pointer">
          <div className="bg-gradient-to-br from-brand-mint via-emerald-500 to-teal-500 rounded-3xl p-6 shadow-2xl shadow-brand-mint/20 transform hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <span className="text-white/80 text-sm font-medium">Wallet Balance</span>
              </div>
              <Sparkles className="w-5 h-5 text-white/60 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">
                ₦{wallet?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
              <TrendingUp className="w-5 h-5 text-white/60 mb-2" />
            </div>
          </div>
        </div>

        {/* Purchase Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 shadow-2xl mb-8">
          {/* Phone Number Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0801 234 5678"
                maxLength={11}
                className="w-full bg-slate-900/50 border-2 border-slate-700 rounded-2xl px-5 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:border-brand-mint transition-all duration-300"
              />
              {selectedNetwork && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-2xl">{selectedNetworkData?.darkIcon}</span>
                </div>
              )}
            </div>
          </div>

          {/* Network Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Select Network
            </label>
            <div className="grid grid-cols-4 gap-3">
              {NETWORKS.map((network) => (
                <button
                  key={network.id}
                  onClick={() => setSelectedNetwork(network.id)}
                  className={`relative p-4 rounded-2xl border-2 transition-all duration-300 group ${
                    selectedNetwork === network.id
                      ? 'border-brand-mint bg-brand-mint/10 scale-105 shadow-lg shadow-brand-mint/20'
                      : 'border-slate-700 bg-slate-900/30 hover:border-slate-600 hover:scale-105'
                  }`}
                >
                  <div className="text-3xl mb-2">{network.icon}</div>
                  <p className={`text-xs md:text-base font-bold ${
                    selectedNetwork === network.id ? 'text-brand-mint' : 'text-slate-400'
                  }`}>
                    {network.name}
                  </p>
                  {selectedNetwork === network.id && (
                    <div className="absolute -top-1 -right-1">
                      <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-brand-mint fill-brand-mint" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
                ₦
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-900/50 border-2 border-slate-700 rounded-2xl pl-12 pr-5 py-4 text-white text-2xl font-bold placeholder:text-slate-600 focus:outline-none focus:border-brand-mint transition-all duration-300"
                min="50"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Minimum: ₦50
            </p>
          </div>

          {/* Quick Amount Buttons */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-400 mb-3">Quick Select</p>
            <div className="grid grid-cols-4 gap-2">
              {[100, 200, 500, 1000].map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => setAmount(quickAmount.toString())}
                  className="py-3 px-4 bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 border border-slate-600"
                >
                  ₦{quickAmount}
                </button>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          {numAmount >= 50 && (
            <div className="mb-6 p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-brand-mint/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-brand-mint/10 rounded-lg">
                  <Info className="w-4 h-4 text-brand-mint" />
                </div>
                <p className="text-sm font-bold text-brand-mint">Price Breakdown</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Airtime</span>
                  <span className="font-bold text-white text-lg">₦{numAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm flex items-center gap-1">
                    Service Fee (2%)
                  </span>
                  <span className="font-semibold text-slate-300">₦{commission.toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t border-slate-700 flex justify-between items-center">
                  <span className="text-brand-mint font-bold">Total</span>
                  <span className="text-brand-mint font-black text-2xl">₦{totalCharge.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Button */}
          <button
            onClick={handlePurchase}
            disabled={isPurchasing || !phoneNumber || !amount || !selectedNetwork || numAmount < 50}
            className="w-full bg-gradient-to-r from-brand-mint via-emerald-500 to-teal-500 text-slate-900 font-black text-lg py-5 rounded-2xl hover:shadow-2xl hover:shadow-brand-mint/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group hover:scale-[1.02] active:scale-[0.98]"
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
            <div className="p-2 bg-slate-800 rounded-xl">
              <Clock className="w-5 h-5 text-brand-mint" />
            </div>
            <h3 className="text-xl font-bold">Recent Purchases</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl p-12 text-center border border-slate-700/50">
              <div className="w-20 h-20 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-10 h-10 text-slate-600" />
              </div>
              <p className="text-slate-400 font-medium">No purchase history yet</p>
              <p className="text-slate-600 text-sm mt-1">Your transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const txNetwork = NETWORKS.find(n => n.id === tx.network);
                return (
                  <div 
                    key={tx.id} 
                    className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 hover:scale-[1.01] group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{txNetwork?.darkIcon}</div>
                        <div>
                          <p className="font-bold text-white text-lg">₦{tx.amount.toLocaleString()}</p>
                          <p className="text-sm text-slate-400 font-mono">{tx.phone_number}</p>
                          <p className="text-xs text-slate-500 capitalize mt-1">{tx.network}</p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide ${
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
                    <div className="flex items-center gap-2 text-xs text-slate-500">
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