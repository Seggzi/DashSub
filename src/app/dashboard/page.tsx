'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import Link from 'next/link';
import {
    Wallet, LogOut, Zap, Smartphone, Lightbulb,
    Tv, GraduationCap, History, Bell, Plus,
    LayoutDashboard, Share2, User, Eye, EyeOff,
    Copy, Check, ChevronRight, Menu, X, ChevronDown,
    ArrowDownLeft, ArrowUpRight, Phone, Sparkles, CreditCard
} from 'lucide-react';

interface Transaction {
  id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending' | 'completed';
  created_at: string;
  reference: string;
  type: 'deposit' | 'airtime' | 'data' | 'withdrawal' | string;
  phone_number?: string;
  network?: string;
  metadata?: any;
}

interface Profile {
  id: string;
  full_name?: string;
  phone_number?: string;
  account_number?: string;
  monnify_account_reference?: string;
  monnify_accounts?: any[];
}

export default function VtuDashboard() {
    const { session, isLoading } = useSupabaseSession(); 
    const router = useRouter();

    const [wallet, setWallet] = useState<{ balance: number } | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showBalance, setShowBalance] = useState(true);
    const [copied, setCopied] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [servicesOpen, setServicesOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isLoading) return;
        if (!session) { router.push('/auth'); return; }

        const userId = session.user?.id;
        if (!userId) return;

        async function loadData() {
            const { data: profileData } = await supabase
                .from('profiles').select('*').eq('id', userId).single();
            if (profileData) setProfile(profileData);

            const { data: walletData, error: walletError } = await supabase
                .from('wallets').select('balance').eq('user_id', userId).single();
            if (walletError && walletError.code === 'PGRST116') {
                const { error: createError } = await supabase
                    .from('wallets').insert({ user_id: userId, balance: 0 });
                if (!createError) setWallet({ balance: 0 });
            } else if (walletData) {
                setWallet(walletData);
            }

            const { data: transData } = await supabase
                .from('transactions').select('*').eq('user_id', userId)
                .order('created_at', { ascending: false }).limit(5);
            if (transData) setTransactions(transData);

            setLoading(false);
        }

        loadData();

        const walletChannel = supabase.channel('wallet_fund')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'wallets',
                filter: `user_id=eq.${userId}`
            }, (payload) => { setWallet(payload.new as { balance: number }); })
            .subscribe();

        const txChannel = supabase.channel(`user_tx_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'transactions',
                filter: `user_id=eq.${userId}`,
            }, (payload) => {
                setTransactions((prev) => [payload.new as Transaction, ...prev.slice(0, 4)]);
            }).subscribe();

        return () => { 
            supabase.removeChannel(walletChannel);
            supabase.removeChannel(txChannel);
        };
    }, [session, isLoading, router]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    if (isLoading || loading) {
        return (
            <div className="min-h-screen bg-brand-primary flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand-mint border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Derive display name and avatar letter
    const displayName = profile?.full_name?.split(' ')[0]
        || session?.user.email?.split('@')[0]
        || 'User';
    const avatarLetter = (profile?.full_name?.[0] || session?.user.email?.[0] || 'U').toUpperCase();

    return (
        <div className="min-h-screen bg-brand-primary text-white flex overflow-hidden">

            {/* ── SIDEBAR OVERLAY (mobile) ── */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── SIDEBAR ── */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-carbon border-r border-white/5 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
                <div className="flex flex-col h-full p-5 overflow-y-auto">
                    {/* Logo row */}
                    <div className="flex items-center gap-3 mb-8 px-1">
                        <div className="bg-brand-mint px-2 py-1 rounded-lg text-brand-carbon font-black text-xs shadow-[0_0_15px_rgba(83,230,212,0.3)]">DS</div>
                        <span className="text-lg font-black tracking-tighter">DASH<span className="text-brand-mint">SUB</span></span>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden ml-auto text-brand-gray/50 hover:text-white p-1"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <nav className="flex-1 space-y-1">
                        <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active href="/dashboard" />
                        <NavItem icon={<Wallet size={18} />} label="Funding" href="/dashboard/fund" />

                        <div>
                            <button
                                onClick={() => setServicesOpen(!servicesOpen)}
                                className="w-full flex items-center gap-3 px-3 py-3 text-brand-gray/60 hover:text-white hover:bg-white/5 rounded-xl transition-all text-sm font-bold"
                            >
                                <Zap size={18} />
                                <span>Services</span>
                                <ChevronDown size={14} className={`ml-auto transition-transform ${servicesOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {servicesOpen && (
                                <div className="ml-9 mt-1 space-y-1 border-l border-white/5 pl-3">
                                    <SubNavItem label="Buy Data"      href="/dashboard/services/buy-data" />
                                    <SubNavItem label="Airtime Topup" href="/dashboard/services/airtime" />
                                    <SubNavItem label="Electricity"   href="/dashboard/electricity" />
                                    <SubNavItem label="Cable TV"      href="/dashboard/cable" />
                                    <SubNavItem label="Exam PINs"     href="/dashboard/exam" />
                                </div>
                            )}
                        </div>

                        <NavItem icon={<History size={18} />}      label="Transactions"  href="/dashboard/transactions" />
                        <NavItem icon={<Bell size={18} />}         label="Notifications" href="/dashboard/notifications" />
                        <NavItem icon={<Share2 size={18} />}       label="Refer & Earn"  badge="Hot" href="/dashboard/referrals" />
                        <NavItem icon={<User size={18} />}         label="My Profile"    href="/dashboard/profile" />
                    </nav>

                    <div className="pt-4 border-t border-white/5 mt-4">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all font-bold text-sm"
                        >
                            <LogOut size={18} /> Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 lg:ml-64 h-screen overflow-y-auto flex flex-col">

                {/* ── UNIFIED TOP HEADER (works on both mobile & desktop) ── */}
                <header className="sticky top-0 z-30 bg-brand-carbon/90 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 h-14 flex items-center justify-between gap-3 flex-shrink-0">

                    {/* Left: hamburger (mobile) + greeting */}
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Hamburger — mobile only */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex-shrink-0"
                        >
                            <Menu size={18} />
                        </button>

                        {/* DS logo — mobile only (shows when sidebar is hidden) */}
                        <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
                            <div className="bg-brand-mint px-1.5 py-0.5 rounded text-brand-carbon font-black text-[10px]">DS</div>
                        </div>

                        {/* Greeting — desktop */}
                        <p className="hidden lg:block text-sm text-white/70 font-medium truncate">
                            Welcome back,{' '}
                            <span className="text-white font-bold">{displayName}</span>
                        </p>
                    </div>

                    {/* Right: notification bell + avatar */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Notification Bell */}
                        <NotificationBell />

                        {/* Divider */}
                        <div className="w-px h-6 bg-white/10 hidden sm:block" />

                        {/* Avatar pill */}
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1 pr-3 py-1 cursor-pointer hover:bg-white/10 transition">
                            <div className="w-7 h-7 rounded-full bg-brand-mint/20 border border-brand-mint/30 flex items-center justify-center text-brand-mint font-black text-xs flex-shrink-0">
                                {avatarLetter}
                            </div>
                            <span className="hidden sm:block text-xs font-semibold text-white/80 max-w-[100px] truncate">
                                {displayName}
                            </span>
                        </div>
                    </div>
                </header>

                {/* ── PAGE CONTENT ── */}
                <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-5">

                    {/* WELCOME AREA */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg md:text-2xl font-black">Account Overview</h1>
                            <p className="text-brand-gray/60 text-xs">Manage your balance and VTU services</p>
                        </div>
                        {profile?.account_number && (
                            <div className="bg-brand-mint/10 text-brand-mint px-3 py-1.5 rounded-full text-[10px] font-bold border border-brand-mint/20 hidden sm:block">
                                ID: {profile.account_number}
                            </div>
                        )}
                    </div>

                    {/* WALLET & VIRTUAL ACCOUNT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Wallet Balance */}
                        <div className="bg-brand-carbon rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-mint/5 rounded-full blur-2xl pointer-events-none" />
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray/50">Wallet Balance</span>
                                <button
                                    onClick={() => setShowBalance(!showBalance)}
                                    className="text-brand-gray/50 hover:text-brand-mint transition p-1"
                                >
                                    {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                            </div>
                            <h2 className="text-3xl font-black mb-1 tracking-tight">
                                {showBalance
                                    ? `₦${wallet?.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 }) || '0.00'}`
                                    : '₦ ••••••'}
                            </h2>
                            <p className="text-[10px] text-brand-gray/40 mb-5">Available to spend</p>
                            <div className="flex gap-2">
                                <Link
                                    href="/dashboard/fund"
                                    className="flex-1 bg-brand-mint text-brand-carbon py-2.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} /> Fund Wallet
                                </Link>
                                <Link
                                    href="/dashboard/transactions"
                                    className="bg-white/5 px-3.5 rounded-xl hover:bg-white/10 transition flex items-center justify-center"
                                >
                                    <History size={16} />
                                </Link>
                            </div>
                        </div>

                        {/* Virtual Account */}
                        {profile?.monnify_accounts && Array.isArray(profile.monnify_accounts) && profile.monnify_accounts.length > 0 ? (
                            <div className="bg-brand-mint/5 border border-brand-mint/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-mint/60">Automated Funding</span>
                                        <div className="bg-brand-mint text-brand-carbon px-2 py-0.5 rounded text-[8px] font-black uppercase">Active</div>
                                    </div>
                                    <p className="text-xs text-brand-gray/60 mb-1">{profile.monnify_accounts[0].bankName}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xl font-black tracking-tight">{profile.monnify_accounts[0].accountNumber}</p>
                                        <button
                                            onClick={() => copyToClipboard(profile.monnify_accounts?.[0]?.accountNumber || '')}
                                            className="p-2 hover:bg-brand-mint/20 rounded-lg text-brand-mint transition"
                                        >
                                            {copied ? <Check size={15} /> : <Copy size={15} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-brand-gray/60 mt-1">{profile.monnify_accounts[0].accountName}</p>
                                    {profile.monnify_accounts.length > 1 && (
                                        <p className="text-[10px] text-brand-mint/60 mt-2">
                                            +{profile.monnify_accounts.length - 1} more bank{profile.monnify_accounts.length > 2 ? 's' : ''} available
                                        </p>
                                    )}
                                </div>
                                <p className="text-[10px] text-brand-gray/40 italic">
                                    Funds sent here reflect instantly in your balance.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-brand-mint/5 border border-brand-mint/10 rounded-2xl p-5 text-center flex flex-col justify-center gap-3">
                                <CreditCard className="w-10 h-10 text-brand-mint/40 mx-auto" />
                                <div>
                                    <p className="text-sm font-bold text-brand-gray/60 mb-1">Get Virtual Account</p>
                                    <p className="text-xs text-brand-gray/40">Create a dedicated account for instant funding</p>
                                </div>
                                <Link
                                    href="/dashboard/fund"
                                    className="inline-flex items-center gap-2 bg-brand-mint text-brand-carbon px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-transform mx-auto"
                                >
                                    <Plus size={13} /> Create Now
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* QUICK SERVICES */}
                    <section>
                        <p className="font-bold uppercase text-[10px] tracking-widest text-brand-gray/50 mb-3">Quick Services</p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            <ServiceBox icon={<Zap      className="text-brand-mint"  size={26} />} label="Buy Data"    href="/dashboard/services/buy-data" />
                            <ServiceBox icon={<Smartphone className="text-blue-400"  size={26} />} label="Airtime"     href="/dashboard/services/airtime" />
                            <ServiceBox icon={<Tv        className="text-purple-400" size={26} />} label="Cable TV"    href="/dashboard/cable" />
                            <ServiceBox icon={<Lightbulb className="text-yellow-400" size={26} />} label="Electricity" href="/dashboard/electricity" />
                            <ServiceBox icon={<GraduationCap className="text-pink-400" size={26} />} label="Exam PINs" href="/dashboard/exam" />
                        </div>
                    </section>

                    {/* PROMO BANNER */}
                    <div className="bg-gradient-to-r from-brand-mint/20 to-transparent border border-brand-mint/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div>
                            <h4 className="font-black text-brand-mint mb-1 uppercase text-xs">Referral Program Coming Soon!</h4>
                            <p className="text-xs text-brand-gray/60">Get ₦500 bonus for every active user you bring to the platform.</p>
                        </div>
                        <Share2 size={20} className="text-brand-mint/40 hidden sm:block flex-shrink-0" />
                    </div>

                    {/* RECENT TRANSACTIONS */}
                    <section className="bg-brand-carbon rounded-2xl border border-white/5 overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-xs uppercase tracking-widest text-brand-gray/50">Recent Transactions</h3>
                            <Link href="/dashboard/transactions" className="text-brand-mint text-xs font-bold hover:underline">View All</Link>
                        </div>
                        <div className="divide-y divide-white/5">
                            {transactions.length === 0 ? (
                                <div className="p-8 text-center text-brand-gray/60 text-sm">
                                    No recent transactions
                                </div>
                            ) : (
                                transactions.map((tx) => (
                                    <div key={tx.id} className="px-4 py-3.5 md:px-5 flex items-center justify-between hover:bg-white/[0.02] transition cursor-pointer group gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-brand-mint group-hover:scale-110 transition-transform flex-shrink-0">
                                                {tx.type === 'deposit'    && <ArrowDownLeft size={16} />}
                                                {tx.type === 'withdrawal' && <ArrowUpRight  size={16} />}
                                                {tx.type === 'airtime'   && <Phone         size={16} />}
                                                {tx.type === 'data'      && <Sparkles      size={16} />}
                                                {!['deposit','withdrawal','airtime','data'].includes(tx.type) && <Zap size={16} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate">
                                                    {tx.network ? tx.network.toUpperCase() + ' ' : ''}
                                                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                                                    {tx.type !== 'deposit' && tx.type !== 'withdrawal' ? ' Purchase' : ''}
                                                </p>
                                                <p className="text-[10px] text-brand-gray/40 truncate">
                                                    {new Date(tx.created_at).toLocaleString('en-GB', {
                                                        month: 'short', day: 'numeric',
                                                        year: 'numeric', hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-black">
                                                {tx.type === 'deposit' ? '+' : '-'}₦{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className={`text-[9px] font-black uppercase ${
                                                tx.status === 'success' || tx.status === 'completed' ? 'text-emerald-500' :
                                                tx.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                                            }`}>
                                                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                </div>
            </main>
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────

function NavItem({ icon, label, active = false, badge = '', href = '#' }: {
    icon: React.ReactNode; label: string; active?: boolean; badge?: string; href?: string;
}) {
    return (
        <Link
            href={href}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold ${
                active
                    ? 'bg-brand-mint text-brand-carbon shadow-[0_0_20px_rgba(83,230,212,0.2)]'
                    : 'text-brand-gray/60 hover:text-white hover:bg-white/5'
            }`}
        >
            {icon}
            <span className="flex-1">{label}</span>
            {badge && (
                <span className="text-[8px] bg-brand-mint text-brand-carbon px-1.5 py-0.5 rounded font-black uppercase">
                    {badge}
                </span>
            )}
        </Link>
    );
}

function SubNavItem({ label, href = '#' }: { label: string; href?: string }) {
    return (
        <Link
            href={href}
            className="block py-1.5 text-xs text-brand-gray/60 hover:text-white transition-all pl-2"
        >
            {label}
        </Link>
    );
}

function ServiceBox({ icon, label, href = '#' }: { icon: React.ReactNode; label: string; href?: string }) {
    return (
        <Link
            href={href}
            className="bg-brand-carbon border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center gap-2.5 hover:border-brand-mint/50 transition-all cursor-pointer group hover:-translate-y-1"
        >
            <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-brand-mint/10 transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-bold text-brand-gray/80 group-hover:text-white text-center leading-tight">
                {label}
            </span>
        </Link>
    );
}