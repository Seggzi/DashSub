'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Wallet,
  Building2,
  Copy,
  CheckCircle2,
  Loader2,
  AlertCircle,
  CreditCard,
  History,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  reference: string;
  type: string;
}

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export default function FundWallet() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState<'transfer' | 'card'>('transfer');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paystackLoaded, setPaystackLoaded] = useState(false);

  // Load Paystack script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setPaystackLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/auth');
      return;
    }
    loadData();

    // Realtime updates
    const channel = supabase
      .channel('wallet_updates_fund')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${session.user.id}`
      }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionLoading, router]);

  const loadData = async () => {
    if (!session?.user?.id) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    const { data: transData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'deposit')
      .order('created_at', { ascending: false })
      .limit(5);

    setProfile(profileData);
    setWallet(walletData);
    setTransactions(transData || []);
    setLoading(false);
  };

  const createVirtualAccount = async () => {
    setCreatingAccount(true);
    
    try {
      const response = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session!.user.id }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Virtual account created! 🎉');
        loadData();
      } else {
        toast.error(data.message || 'Failed to create account');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleCardPayment = async () => {
    const numAmount = Number(amount);

    if (numAmount < 100) {
      toast.error('Minimum funding amount is ₦100');
      return;
    }

    if (!paystackLoaded || !window.PaystackPop) {
      toast.error('Payment system is loading. Please try again.');
      return;
    }

    setIsProcessing(true);
    const reference = `DS_FUND_${Date.now()}`;

    // Create pending transaction
    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: session!.user.id,
      amount: numAmount,
      reference,
      status: 'pending',
      type: 'deposit',
      payment_method: 'card',
    });

    if (insertError) {
      toast.error('Failed to create transaction');
      setIsProcessing(false);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email: session!.user.email!,
      amount: numAmount * 100,
      currency: 'NGN',
      ref: reference,
      callback: async function (response: any) {
        try {
          await supabase
            .from('transactions')
            .update({ status: 'success' })
            .eq('reference', reference);

          toast.success('Payment successful! 🎉');
          setAmount('');
          loadData();
        } catch (err) {
          toast.error('Error processing payment');
        } finally {
          setIsProcessing(false);
        }
      },
      onClose: () => {
        setIsProcessing(false);
      },
    });

    handler.openIframe();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(''), 2000);
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-mint" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-brand-gray/60 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-brand-mint to-emerald-400 rounded-2xl">
              <Wallet className="w-6 h-6 text-brand-carbon" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Fund Wallet</h1>
              <p className="text-brand-gray/60 text-sm mt-1">
                Add money to your DashSub wallet
              </p>
            </div>
          </div>
        </div>

        {/* Current Balance */}
        <div className="bg-brand-carbon rounded-3xl p-6 border border-white/5 mb-6">
          <p className="text-xs text-brand-gray/60 uppercase tracking-wider mb-2">
            Current Balance
          </p>
          <p className="text-4xl font-black text-brand-mint">
            ₦{wallet?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-brand-carbon rounded-2xl p-1 flex gap-1 mb-6 border border-white/5">
          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'transfer' 
                ? 'bg-brand-mint text-brand-carbon' 
                : 'text-brand-gray/60 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Bank Transfer
          </button>
          <button
            onClick={() => setActiveTab('card')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'card' 
                ? 'bg-brand-mint text-brand-carbon' 
                : 'text-brand-gray/60 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Card Payment
          </button>
        </div>

        {/* Content */}
        {activeTab === 'transfer' ? (
          profile?.virtual_account_number ? (
            /* Virtual Account Card */
            <div className="bg-gradient-to-br from-brand-mint to-emerald-400 rounded-3xl p-8 shadow-2xl mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <Building2 className="w-6 h-6 text-brand-carbon" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-brand-carbon">
                    Your Dedicated Account
                  </h2>
                  <p className="text-brand-carbon/70 text-sm">
                    Transfer to this account anytime
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Bank Name */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                  <p className="text-xs text-brand-carbon/70 uppercase tracking-wider mb-1">
                    Bank Name
                  </p>
                  <p className="text-brand-carbon font-bold text-lg">
                    {profile.virtual_account_bank}
                  </p>
                </div>

                {/* Account Number */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                  <p className="text-xs text-brand-carbon/70 uppercase tracking-wider mb-1">
                    Account Number
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-brand-carbon font-black text-2xl tracking-wider">
                      {profile.virtual_account_number}
                    </p>
                    <button
                      onClick={() => copyToClipboard(profile.virtual_account_number, 'Account number')}
                      className="p-3 hover:bg-white/10 rounded-xl transition-colors"
                    >
                      {copied === 'Account number' ? (
                        <CheckCircle2 className="w-5 h-5 text-brand-carbon" />
                      ) : (
                        <Copy className="w-5 h-5 text-brand-carbon" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Account Name */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                  <p className="text-xs text-brand-carbon/70 uppercase tracking-wider mb-1">
                    Account Name
                  </p>
                  <p className="text-brand-carbon font-bold text-lg">
                    {profile.virtual_account_name}
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-brand-carbon/20 backdrop-blur-sm rounded-2xl">
                <div className="flex gap-3">
                  <Zap className="w-5 h-5 text-brand-carbon flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-brand-carbon text-sm font-semibold mb-1">
                      Instant Credit
                    </p>
                    <p className="text-brand-carbon/80 text-xs">
                      Transfers reflect within seconds. Use this account anytime!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Create Account */
            <div className="bg-brand-carbon rounded-3xl p-8 border border-white/5 text-center">
              <div className="w-20 h-20 bg-brand-mint/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-10 h-10 text-brand-mint" />
              </div>
              <h3 className="text-xl font-bold mb-2">Get Your Virtual Account</h3>
              <p className="text-brand-gray/60 mb-6 max-w-md mx-auto">
                Create a dedicated account number for instant wallet funding
              </p>
              <button
                onClick={createVirtualAccount}
                disabled={creatingAccount}
                className="bg-gradient-to-r from-brand-mint to-emerald-400 text-brand-carbon font-black px-8 py-4 rounded-2xl hover:shadow-2xl transition-all disabled:opacity-50 inline-flex items-center gap-3"
              >
                {creatingAccount ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5" />
                    Create Virtual Account
                  </>
                )}
              </button>
            </div>
          )
        ) : (
          /* Card Payment */
          <div className="bg-brand-carbon rounded-3xl p-6 border border-white/5">
            <h3 className="text-lg font-semibold mb-4">Fund with Card</h3>

            <div className="mb-4">
              <label className="block text-sm text-brand-gray/60 mb-2">Amount (₦)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-brand-primary border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-brand-mint transition-all"
                min="100"
              />
              <p className="text-xs text-brand-gray/60 mt-2">Minimum: ₦100</p>
            </div>

            <button
              onClick={handleCardPayment}
              disabled={isProcessing || !amount || Number(amount) < 100 || !paystackLoaded}
              className="w-full bg-gradient-to-r from-brand-mint to-emerald-400 text-brand-carbon font-black py-4 rounded-2xl hover:shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing...
                </>
              ) : !paystackLoaded ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-6 h-6" />
                  Pay Securely
                </>
              )}
            </button>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Deposits
          </h3>

          {transactions.length === 0 ? (
            <div className="bg-brand-carbon rounded-2xl p-8 text-center border border-white/5">
              <p className="text-brand-gray/60">No deposit history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="bg-brand-carbon rounded-2xl p-4 border border-white/5 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">₦{tx.amount.toLocaleString()}</p>
                    <p className="text-xs text-brand-gray/60">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      tx.status === 'completed' || tx.status === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : tx.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}