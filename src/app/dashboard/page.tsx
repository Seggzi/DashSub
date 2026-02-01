'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Wallet, LogOut, Zap, Smartphone, Lightbulb,
    Tv, GraduationCap, History, Bell, Plus,
    LayoutDashboard, Share2, User, Eye, EyeOff,
    Copy, Check, ChevronRight, Menu, X, ChevronDown
} from 'lucide-react';

export default function VtuDashboard() {
    // FIX: Destructure isLoading (or whatever your provider calls the loading state)
    const { session, isLoading } = useSupabaseSession(); 
    const router = useRouter();

    // States
    const [wallet, setWallet] = useState<{ balance: number } | null>(null);
    const [showBalance, setShowBalance] = useState(true);
    const [copied, setCopied] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [servicesOpen, setServicesOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [unreadNotifications] = useState(3); // Placeholder — real count from DB later

    // Virtual Account (placeholder — real from Paystack later)
    const virtualAccount = {
        bank: "Wema Bank",
        accNo: "8123456789",
        name: session?.user.email ? `DS-User-${session.user.email.split('@')[0]}` : 'DS-User'
    };

    useEffect(() => {
        // FIX: If the session is still being fetched from storage, do NOT redirect yet.
        if (isLoading) return;

        // 1. If no session, redirect and stop execution
        if (!session) {
            router.push('/auth');
            return;
        }

        // 2. Capture the ID in a constant to satisfy TypeScript
        const userId = session.user?.id;
        if (!userId) return;

        async function loadWallet() {
            const { data, error } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId) // Using the constant here
                .single();

            if (error && error.code === 'PGRST116') {
                const { error: createError } = await supabase
                    .from('wallets')
                    .insert({ user_id: userId, balance: 0 }); // And here
                if (!createError) setWallet({ balance: 0 });
            } else if (data) {
                setWallet(data);
            }
            setLoading(false);
        }

        loadWallet();

        // 3. Realtime subscription (Fixed ID reference)
        const channel = supabase
            .channel('wallet_fund')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'wallets',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                setWallet(payload.new as { balance: number });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session, isLoading, router]); // Added isLoading to dependencies

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    // FIX: If session is still loading, show the spinner before we even try to check session existence
    if (isLoading || loading) {
        return (
            <div className="min-h-screen bg-brand-primary flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand-mint border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-primary text-white flex overflow-hidden">

            {/* --- SIDEBAR --- */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-brand-carbon border-r border-white/5 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
                <div className="flex flex-col h-full p-6 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <div className="bg-brand-mint p-1.5 rounded-lg text-brand-carbon font-black shadow-[0_0_15px_rgba(182,255,206,0.3)]">DS</div>
                        <span className="text-xl font-black tracking-tighter">DASH<span className="text-brand-mint">SUB</span></span>
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-brand-gray/50 hover:text-white"><X size={24} /></button>
                    </div>

                    <nav className="flex-1 space-y-1">
                        <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active href="/dashboard" />
                        <NavItem icon={<Wallet size={20} />} label="Funding" href="/dashboard/fund" />

                        {/* Services Dropdown */}
                        <div>
                            <button
                                onClick={() => setServicesOpen(!servicesOpen)}
                                className="w-full flex items-center gap-4 px-4 py-3.5 text-brand-gray/60 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                            >
                                <Zap size={20} />
                                <span className="text-sm font-bold">Services</span>
                                <ChevronDown size={16} className={`ml-auto transition-transform ${servicesOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {servicesOpen && (
                                <div className="ml-12 mt-2 space-y-2 border-l border-white/5 pl-4">
                                    <SubNavItem label="Buy Data" href="/dashboard/data" />
                                    <SubNavItem label="Airtime Topup" href="/dashboard/airtime" />
                                    <SubNavItem label="Electricity" href="/dashboard/electricity" />
                                    <SubNavItem label="Cable TV" href="/dashboard/cable" />
                                    <SubNavItem label="Exam PINs" href="/dashboard/exam" />
                                </div>
                            )}
                        </div>

                        <NavItem icon={<History size={20} />} label="Transactions" href="/dashboard/transactions" />
                        <NavItem icon={<Bell size={20} />} label="Notifications" badge={unreadNotifications > 0 ? unreadNotifications.toString() : ''} href="/dashboard/notifications" />
                        <NavItem icon={<Share2 size={20} />} label="Refer & Earn" badge="Hot" href="/dashboard/referrals" />
                        <NavItem icon={<User size={20} />} label="My Profile" href="/dashboard/profile" />
                    </nav>

                    <div className="pt-6 border-t border-white/5 mt-6">
                        <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 text-red-400/70 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all font-bold text-sm">
                            <LogOut size={20} /> Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 lg:ml-72 h-screen overflow-y-auto">

                {/* Top Welcome Bar */}
                <header className="bg-brand-carbon/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
                    <p className="text-white/80 font-medium">Welcome back, {session?.user.email?.split('@')[0] || 'User'}</p>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Bell size={20} className="text-white/80" />
                            {unreadNotifications > 0 && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-mint rounded-full animate-pulse" />
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-brand-mint/20 flex items-center justify-center text-brand-mint border border-brand-mint/30 font-bold">
                            {session?.user.email?.[0].toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between p-4 bg-brand-carbon border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="bg-brand-mint p-1 rounded-md text-brand-carbon font-black text-xs">DS</div>
                        <span className="font-black text-sm">DASHSUB</span>
                    </div>
                    <button onClick={() => setSidebarOpen(true)} className="p-2 bg-white/5 rounded-lg"><Menu size={20} /></button>
                </header>

                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

                    {/* WELCOME AREA */}
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-xl md:text-2xl font-black">Account Overview</h1>
                            <p className="text-brand-gray/60 text-xs md:text-sm">Manage your balance and VTU services</p>
                        </div>
                        <div className="hidden md:block bg-brand-mint/10 text-brand-mint px-4 py-2 rounded-full text-xs font-bold border border-brand-mint/20">
                            ID: 8842910
                        </div>
                    </div>

                    {/* WALLET & VIRTUAL ACCOUNT CARD */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Wallet Balance */}
                        <div className="bg-brand-carbon rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray/50">Wallet Balance</span>
                                <button onClick={() => setShowBalance(!showBalance)} className="text-brand-gray/50 hover:text-brand-mint transition">
                                    {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                            <h2 className="text-4xl font-black mb-6">
                                {showBalance ? `₦${wallet?.balance.toFixed(2) || '0.00'}` : "••••••"}
                            </h2>
                            <div className="flex gap-3">
                                <Link href="/dashboard/fund" className="flex-1 bg-brand-mint text-brand-carbon py-3 rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-2">
                                    <Plus size={18} /> Fund Wallet
                                </Link>
                                <Link href="/dashboard/transactions" className="bg-white/5 px-4 rounded-xl hover:bg-white/10 transition flex items-center justify-center">
                                    <History size={18} />
                                </Link>
                            </div>
                        </div>

                        {/* Virtual Account (Opay Style) */}
                        <div className="bg-brand-mint/5 border border-brand-mint/10 rounded-[2rem] p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-mint/60">Automated Funding</span>
                                    <div className="bg-brand-mint text-brand-carbon px-2 py-0.5 rounded text-[8px] font-black uppercase">Active</div>
                                </div>
                                <p className="text-xs text-brand-gray/60 mb-1">{virtualAccount.bank}</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-xl font-black tracking-tight">{virtualAccount.accNo}</p>
                                    <button onClick={() => copyToClipboard(virtualAccount.accNo)} className="p-2 hover:bg-brand-mint/20 rounded-lg text-brand-mint transition relative">
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-brand-gray/40 mt-4 italic">Funds sent to this account reflect instantly in your balance.</p>
                        </div>
                    </div>

                    {/* QUICK SERVICES SECTION */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold uppercase text-[10px] tracking-widest text-brand-gray/50">Quick Services</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <ServiceBox icon={<Zap className="text-brand-mint" size={32} />} label="Buy Data" href="/dashboard/data" />
                            <ServiceBox icon={<Smartphone className="text-blue-400" size={32} />} label="Airtime" href="/dashboard/airtime" />
                            <ServiceBox icon={<Tv className="text-purple-400" size={32} />} label="Cable TV" href="/dashboard/cable" />
                            <ServiceBox icon={<Lightbulb className="text-yellow-400" size={32} />} label="Electricity" href="/dashboard/electricity" />
                            <ServiceBox icon={<GraduationCap className="text-pink-400" size={32} />} label="Exam PINs" href="/dashboard/exam" />
                        </div>
                    </section>

                    {/* PROMO BANNER */}
                    <div className="bg-gradient-to-r from-brand-mint/20 to-transparent border border-brand-mint/10 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                            <h4 className="font-black text-brand-mint mb-1 uppercase text-sm">Referral Program Coming Soon!</h4>
                            <p className="text-xs text-brand-gray/60">Get ₦500 bonus for every active user you bring to the platform.</p>
                        </div>
                        <Share2 size={24} className="text-brand-mint/40 hidden sm:block" />
                    </div>

                    {/* RECENT TRANSACTIONS (OPAY STYLE) */}
                    <section className="bg-brand-carbon rounded-[2rem] border border-white/5 overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-sm uppercase tracking-widest text-brand-gray/50">Recent Transactions</h3>
                            <Link href="/dashboard/transactions" className="text-brand-mint text-xs font-bold hover:underline">View All</Link>
                        </div>
                        <div className="divide-y divide-white/5">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="p-4 md:p-6 flex items-center justify-between hover:bg-white/[0.02] transition cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-mint group-hover:scale-110 transition-transform">
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">MTN Data Purchase</p>
                                            <p className="text-[10px] text-brand-gray/40">Feb 01, 2026 • 14:20</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black">- ₦450.00</p>
                                        <p className="text-[9px] font-black uppercase text-emerald-500">Success</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                </div>
            </main>
        </div>
    );
}

// Sub-components
function NavItem({ icon, label, active = false, badge = "", href = "#" }: { icon: React.ReactNode; label: string; active?: boolean; badge?: string; href?: string }) {
    return (
        <Link
            href={href}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-brand-mint text-brand-carbon font-black shadow-[0_0_20px_rgba(83,230,212,0.2)]' : 'text-brand-gray/60 hover:text-white hover:bg-white/5'}`}
        >
            {icon}
            <span className="text-sm font-bold">{label}</span>
            {badge && <span className="ml-auto text-[8px] bg-brand-mint text-brand-carbon px-1.5 py-0.5 rounded font-black uppercase">{badge}</span>}
        </Link>
    );
}

function SubNavItem({ label, href = "#" }: { label: string; href?: string }) {
    return (
        <Link
            href={href}
            className="block py-2 text-sm text-brand-gray/60 hover:text-white transition-all pl-2"
        >
            {label}
        </Link>
    );
}

function ServiceBox({ icon, label, href = "#" }: { icon: React.ReactNode; label: string; href?: string }) {
    return (
        <Link
            href={href}
            className="bg-brand-carbon border border-white/5 p-5 rounded-[1.5rem] flex flex-col items-center justify-center gap-3 hover:border-brand-mint/50 transition-all cursor-pointer group hover:-translate-y-1 shadow-xl"
        >
            <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-brand-mint/10 transition-colors">
                {icon}
            </div>
            <span className="text-[11px] font-bold text-brand-gray/80 group-hover:text-white">{label}</span>
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={12} />
            </div>
        </Link>
    );
}