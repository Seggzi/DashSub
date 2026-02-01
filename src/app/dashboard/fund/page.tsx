'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { 
  Wallet, Copy, Check, ArrowLeft, CreditCard, 
  Landmark, Info, History, ShieldCheck, 
  ArrowUpRight, Loader2 
} from 'lucide-react';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  reference: string;
  type: string;
}

export default function FundWallet() {
  const { session, isLoading } = useSupabaseSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'card' | 'transfer'>('card');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const virtualAccount = {
    bank: "Wema Bank",
    accNo: "8123456789",
    name: session?.user?.email ? `DS-${session.user.email.split('@')[0].toUpperCase()}` : 'DS-USER'
  };

  useEffect(() => {
    if (isLoading) return;
    if (!session) { 
      router.push('/auth'); 
      return; 
    }

    const userId = session?.user?.id;
    if (!userId) return;

    async function loadData() {
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      if (walletData) setWallet(walletData);

      const { data: transData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (transData) setTransactions(transData);
      setLoading(false);
    }

    loadData();

    const channel = supabase
      .channel('wallet_sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'wallets', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => {
        setWallet(payload.new as { balance: number });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId}`
      }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, isLoading, router]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(virtualAccount.accNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaystack = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      alert('Minimum funding amount is ₦100');
      return;
    }

    if (typeof window.PaystackPop === 'undefined') {
      alert('Payment system is still loading...');
      return;
    }

    setIsProcessing(true);
    const reference = `DS_FUND_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // FIX: Added 'type' to satisfy your database constraint
    const { error } = await supabase.from('transactions').insert({
      user_id: session?.user?.id,
      amount: numAmount,
      reference: reference,
      status: 'pending',
      type: 'deposit' 
    });

    if (error) {
      console.error("DB Error:", error);
      alert(`Initialization failed: ${error.message}`);
      setIsProcessing(false);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email: session?.user?.email || '',
      amount: Math.round(numAmount * 100),
      currency: 'NGN',
      ref: reference,
      metadata: { user_id: session?.user?.id },
      callback: (response: any) => {
        setAmount('');
        setIsProcessing(false);
        alert('Payment initiated! Your balance will update once confirmed.');
      },
      onClose: () => setIsProcessing(false),
    });

    handler.openIframe();
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand-mint animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-white font-sans selection:bg-brand-mint/30">
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />
      
      <header className="sticky top-0 z-50 bg-[#08080c]/80 backdrop-blur-xl border-b border-white/[0.03] px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="group flex items-center gap-2 text-brand-gray/50 hover:text-white transition-all">
            <ArrowLeft size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Exit</span>
          </Link>
          <div className="flex flex-col items-center">
             <span className="text-[11px] font-black uppercase tracking-[0.3em]">Capital</span>
             <div className="h-0.5 w-4 bg-brand-mint mt-1 rounded-full" />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 md:p-10 max-w-xl mx-auto space-y-8">
        {/* Balance Card */}
        <div className="relative group p-[1px] rounded-[2.5rem] bg-gradient-to-b from-white/10 to-transparent">
          <div className="bg-[#0c0c14] rounded-[2.5rem] p-8 relative overflow-hidden">
            <div className="relative z-10 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-brand-mint/60 uppercase tracking-[0.25em]">Available Balance</p>
                <h2 className="text-4xl font-black tracking-tighter text-white">
                  <span className="text-brand-mint/40 text-2xl mr-1 font-light">₦</span>
                  {wallet?.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </h2>
              </div>
              <div className="w-10 h-10 bg-brand-mint rounded-2xl flex items-center justify-center text-brand-carbon shadow-[0_0_20px_rgba(182,255,206,0.3)]">
                <Wallet size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 bg-white/[0.02] p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab('card')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${activeTab === 'card' ? 'bg-brand-mint text-brand-carbon shadow-xl' : 'text-brand-gray/40 hover:text-white'}`}
          >
            <CreditCard size={12} /> Card Payment
          </button>
          <button 
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${activeTab === 'transfer' ? 'bg-brand-mint text-brand-carbon shadow-xl' : 'text-brand-gray/40 hover:text-white'}`}
          >
            <Landmark size={12} /> Bank Transfer
          </button>
        </div>

        <div className="space-y-6">
          {activeTab === 'card' ? (
            <form onSubmit={(e) => { e.preventDefault(); handlePaystack(); }} className="bg-[#0c0c14] rounded-[2rem] p-6 border border-white/5 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between px-1">
                  <label className="text-[9px] font-black text-brand-gray/40 uppercase tracking-widest">Deposit Amount</label>
                  <span className="text-[8px] font-bold text-brand-mint uppercase tracking-tighter">Min ₦100.00</span>
                </div>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-brand-gray/30 text-xs">₦</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-5 px-10 text-xl font-black outline-none focus:border-brand-mint/50 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-brand-mint text-brand-carbon py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <>Continue Payment <ArrowUpRight size={14} /></>}
              </button>
            </form>
          ) : (
            <div className="bg-[#0c0c14] rounded-[2rem] p-6 border border-white/5 space-y-6">
              <div className="bg-white/[0.01] rounded-2xl p-5 border border-white/5">
                <p className="text-[10px] font-bold text-brand-gray/40 uppercase mb-1">{virtualAccount.bank}</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-black text-white">{virtualAccount.accNo}</p>
                  <button onClick={copyToClipboard} className="p-3 bg-brand-mint/5 text-brand-mint rounded-xl">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <section className="space-y-4">
          <h3 className="px-2 font-black text-[9px] uppercase tracking-[0.2em] text-brand-gray/40">Recent Deposits</h3>
          <div className="bg-[#0c0c14] rounded-[2rem] border border-white/5 divide-y divide-white/5 overflow-hidden">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-brand-gray/40">
                      <History size={14}/>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white">Wallet Funding</p>
                      <p className="text-[9px] text-brand-gray/50">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-brand-mint">+₦{tx.amount.toLocaleString()}</p>
                    <p className={`text-[8px] font-black uppercase ${tx.status === 'success' ? 'text-emerald-500/60' : 'text-amber-500/60'}`}>{tx.status}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-brand-gray/20 text-[10px] font-black uppercase tracking-widest">No deposits yet</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}