'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { 
  Wallet, Copy, Check, ArrowLeft, CreditCard, 
  Landmark, Info, History, ShieldCheck, Zap, Loader2 
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
  const { session, isLoading: sessionLoading } = useSupabaseSession();
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
  if (sessionLoading) return;
  if (!session) {
    router.push('/auth');
    return;
  }

  const userId = session.user.id;

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
      .eq('type', 'deposit')
      .order('created_at', { ascending: false })
      .limit(5);

    if (transData) setTransactions(transData);

    setLoading(false);
  }

  loadData();

  const channel = supabase
    .channel('fund_page')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, (payload) => {
      setWallet(payload.new as { balance: number });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, () => {
      loadData();
    })
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
      alert('Minimum funding amount is ₦100');
      return;
    }

    setIsProcessing(true);

    const reference = `DS_FUND_${Date.now()}`;

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: session?.user.id,
        amount: numAmount,
        reference,
        status: 'pending',
        type: 'deposit',
      });

    if (txError) {
      alert('Failed to initialize');
      setIsProcessing(false);
      return;
    }

    // Paystack setup
    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email: session?.user.email || '',
      amount: numAmount * 100,
      currency: 'NGN',
      ref: reference,
      metadata: { user_id: session?.user.id },
      callback: () => {
        setAmount('');
        setIsProcessing(false);
        alert('Payment successful — balance updating!');
      },
      onClose: () => setIsProcessing(false),
    });

    handler.openIframe();
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-mint animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary text-white font-sans selection:bg-brand-mint/30">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-brand-carbon/40 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="p-1 hover:bg-white/5 rounded-lg transition text-brand-gray/50 hover:text-brand-mint">
            <ArrowLeft size={18} />
          </Link>
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">Add Capital</span>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
        {/* WALLET DISPLAY */}
        <div className="bg-brand-carbon rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-end">
            <div>
              <p className="text-[9px] font-black text-brand-gray/40 uppercase tracking-[0.2em] mb-1">Available Funds</p>
              <h2 className="text-3xl font-black tracking-tighter">₦{wallet?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</h2>
            </div>
            <div className="bg-brand-mint/10 p-2 rounded-xl text-brand-mint border border-brand-mint/20">
              <Wallet size={16} />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-mint/5 rounded-full blur-3xl" />
        </div>

        {/* METHOD TOGGLE */}
        <div className="flex bg-brand-carbon p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab('card')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'card' ? 'bg-brand-mint text-brand-carbon shadow-lg' : 'text-brand-gray/40'}`}
          >
            Online Payment
          </button>
          <button 
            onClick={() => setActiveTab('transfer')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'transfer' ? 'bg-brand-mint text-brand-carbon shadow-lg' : 'text-brand-gray/40'}`}
          >
            Bank Transfer
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="min-h-[300px]">
          {activeTab === 'card' ? (
            <div className="space-y-4">
              {/* Load Paystack script INSIDE the form card */}
              <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />

              <div className="bg-brand-carbon rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-brand-gray/40 uppercase tracking-widest px-1">Funding Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-brand-gray/40 text-xs">₦</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-8 pr-4 text-sm font-bold focus:border-brand-mint outline-none transition-all placeholder:text-brand-gray/20"
                    />
                  </div>
                </div>

                <button
                  onClick={handlePaystack}
                  disabled={isProcessing}
                  className="w-full bg-brand-mint text-brand-carbon py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-mint/10 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <>Initialize Secure Payment <Zap size={14} /></>}
                </button>

                <div className="flex items-center justify-center gap-2 opacity-30">
                  <ShieldCheck size={12} />
                  <span className="text-[8px] font-bold uppercase tracking-widest">PCI-DSS Compliant</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-brand-carbon rounded-3xl p-6 border border-white/5 space-y-5">
                {/* Transfer content - same as before */}
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-brand-mint uppercase tracking-widest bg-brand-mint/5 px-2 py-1 rounded border border-brand-mint/10">Automated Setup</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-brand-mint rounded-full animate-pulse" />
                    <div className="w-1 h-1 bg-brand-mint rounded-full animate-pulse delay-75" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 relative group">
                    <p className="text-[9px] font-bold text-brand-gray/40 uppercase mb-1">{virtualAccount.bank}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-black tracking-tighter text-white">{virtualAccount.accNo}</p>
                      <button onClick={copyToClipboard} className="p-2 hover:bg-brand-mint/10 text-brand-mint rounded-lg transition-colors">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="text-[10px] font-bold text-brand-gray/40 mt-1 uppercase tracking-tighter">{virtualAccount.name}</p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 bg-brand-mint/5 rounded-2xl border border-brand-mint/10">
                  <Info size={14} className="text-brand-mint shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-brand-gray/50 font-medium">
                    Funds sent to this account are automatically credited to your wallet within <span className="text-brand-mint">2-5 minutes</span>. A flat fee of ₦50 applies.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* HISTORY */}
        <section className="bg-brand-carbon rounded-3xl border border-white/5 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-black text-[9px] uppercase tracking-[0.2em] text-brand-gray/40 flex items-center gap-2">
              <History size={14}/> Recent Activity
            </h3>
            <Link href="/dashboard/transactions" className="text-[9px] font-black text-brand-mint uppercase tracking-widest hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-white/5">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-brand-mint">
                      <Landmark size={14}/>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold">Wallet Funding</p>
                      <p className="text-[9px] text-brand-gray/40 font-medium">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-brand-mint">+₦{tx.amount.toLocaleString()}</p>
                    <p className="text-[8px] font-black uppercase text-emerald-500/60 tracking-widest">{tx.status}</p>
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