'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wallet, ArrowLeft, History, ShieldCheck, Zap, Loader2, Landmark, Copy, Check } from 'lucide-react';
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

// Helper functions for payment lock using localStorage
const isPaymentLocked = (reference: string): boolean => {
  if (typeof window === 'undefined') return false;
  const locked = localStorage.getItem(`payment_lock_${reference}`);
  return locked === 'true';
};

const lockPayment = (reference: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`payment_lock_${reference}`, 'true');
  console.log('🔒 LOCKED payment:', reference);
};

const unlockPayment = (reference: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`payment_lock_${reference}`);
  console.log('🔓 UNLOCKED payment:', reference);
};

export default function FundWallet() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'card' | 'transfer'>('card');
  const [copied, setCopied] = useState(false);
  const [paystackLoaded, setPaystackLoaded] = useState(false);

  const virtualAccount = {
    bank: "Wema Bank",
    accNo: "0123456789",
    name: "DASH SUB - " + (session?.user?.email?.split('@')[0] || 'User')
  };

  // Load Paystack script manually
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

  const loadData = async () => {
    if (!session?.user?.id) return;

    const { data: walletData } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', session.user.id)
      .single();

    console.log('Wallet Data:', walletData);
    if (walletData) setWallet(walletData);

    const { data: transData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'deposit')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('Transactions Data:', transData);
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

    // Realtime subscription for wallet updates
    const channel = supabase
      .channel('wallet_updates')
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(virtualAccount.accNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaystack = async () => {
    const numAmount = Number(amount);

    if (numAmount < 100) {
      toast.error('Minimum funding amount is ₦100');
      return;
    }

    if (!paystackLoaded || !window.PaystackPop) {
      toast.error('Payment system is loading. Please try again in a moment.');
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
    });

    if (insertError) {
      console.error('Transaction insert error:', insertError);
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
      callback: function (response: any) {
        // ✅ Check localStorage lock FIRST
        if (isPaymentLocked(reference)) {
          console.log('⚠️ Payment already locked, ignoring duplicate callback');
          return;
        }

        // ✅ Lock IMMEDIATELY
        lockPayment(reference);

        // Process the payment
        (async () => {
          try {
            console.log('💳 Paystack response:', response);

            // ✅ ONLY update transaction status - trigger handles wallet update
            const { error: updateError } = await supabase
              .from('transactions')
              .update({ status: 'success' })
              .eq('reference', reference)
              .eq('status', 'pending');

            if (updateError) {
              console.error('❌ Transaction update error:', updateError);
              throw updateError;
            }

            console.log('✅ Transaction updated to success - database trigger will add funds automatically');

            // ❌ REMOVED: RPC call (the trigger does this now)
            // The database trigger automatically adds money to wallet!
            
            toast.success('Payment received! Your balance will update shortly.');
            setAmount('');

            // Clean up lock after 30 seconds
            setTimeout(() => unlockPayment(reference), 30000);
          } catch (err) {
            console.error('❌ Payment processing error:', err);
            toast.error('Error updating wallet. Please contact support.');
            unlockPayment(reference);
          } finally {
            setIsProcessing(false);
          }
        })();
      },
      onClose: () => {
        setIsProcessing(false);
      },
    });

    handler.openIframe();
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-carbon flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-mint" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-carbon text-white p-6">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-brand-gray hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-brand-mint" />
          Add Capital
        </h1>
      </div>

      {/* Wallet Card */}
      <div className="max-w-md mx-auto bg-gradient-to-br from-brand-mint to-brand-mint/80 rounded-2xl p-6 mb-6 shadow-xl">
        <p className="text-brand-carbon/70 text-sm mb-2">Available Funds</p>
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-carbon" />
            <span className="text-brand-carbon text-sm">Processing payment...</span>
          </div>
        ) : (
          <p className="text-4xl font-bold text-brand-carbon">
            ₦{wallet?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-md mx-auto bg-brand-gray/10 rounded-xl p-1 flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab('card')}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'card' 
              ? 'bg-brand-mint text-brand-carbon shadow-lg' 
              : 'text-brand-gray/40'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-1" />
          Online Payment
        </button>
        <button
          onClick={() => setActiveTab('transfer')}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'transfer' 
              ? 'bg-brand-mint text-brand-carbon shadow-lg' 
              : 'text-brand-gray/40'
          }`}
        >
          <Landmark className="w-4 h-4 inline mr-1" />
          Bank Transfer
        </button>
      </div>

      {/* Content Area */}
      <div className="max-w-md mx-auto">
        {activeTab === 'card' ? (
          <div className="bg-brand-gray/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Fund with Card</h3>

            <div className="mb-4">
              <label className="block text-sm text-brand-gray mb-2">Amount (₦)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-brand-carbon border border-brand-gray/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-mint transition-colors"
                min="100"
              />
              <p className="text-xs text-brand-gray mt-1">Minimum: ₦100</p>
            </div>

            <button
              onClick={handlePaystack}
              disabled={isProcessing || !amount || Number(amount) < 100 || !paystackLoaded}
              className="w-full bg-brand-mint text-brand-carbon font-bold py-3 rounded-lg hover:bg-brand-mint/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : !paystackLoaded ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Pay Securely
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-brand-gray/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Coming Soon</h3>

          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="max-w-md mx-auto mt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Recent Deposits
        </h3>

        {transactions.length === 0 ? (
          <div className="bg-brand-gray/10 rounded-xl p-8 text-center text-brand-gray">
            <p>No deposit history yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-brand-gray/10 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">₦{tx.amount.toLocaleString()}</p>
                  <p className="text-xs text-brand-gray">
                    {new Date(tx.created_at).toLocaleDateString()}
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
  );
}