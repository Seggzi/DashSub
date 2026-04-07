// 'use client';

// import { useEffect, useState } from 'react';
// import { useSupabaseSession } from '@/providers/SupabaseProvider';
// import { supabase } from '@/lib/supabaseClient';
// import { useRouter } from 'next/navigation';
// import Link from 'next/link';
// import {
//   User, Wallet, Calendar, Mail, Shield, LogOut,
//   Edit2, Eye, EyeOff, Copy, Check, ArrowLeft,
//   Loader2, History, CheckCircle2, XCircle, Info,
//   Zap,
//   ChevronRight
// } from 'lucide-react';
// import { toast } from 'sonner';

// export default function Profile() {
//   const { session, isLoading: sessionLoading } = useSupabaseSession();
//   const router = useRouter();

//   const [wallet, setWallet] = useState<{ balance: number } | null>(null);
//   const [showBalance, setShowBalance] = useState(false);
//   const [copied, setCopied] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

//   // Editable profile fields
//   const [fullName, setFullName] = useState('');
//   const [phone, setPhone] = useState('');
//   const [email, setEmail] = useState(session?.user.email || '');
//   const [isEditing, setIsEditing] = useState(false);
//   const [saving, setSaving] = useState(false);

//   // Referral
//   const [referralCode, setReferralCode] = useState('');
//   const referralLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';

//   // KYC status (placeholder - later can come from DB)
//   const [kycStatus, setKycStatus] = useState<'Not Verified' | 'Pending' | 'Verified' | 'Rejected'>('Not Verified');

//   useEffect(() => {
//     if (sessionLoading) return;
//     if (!session) {
//       router.push('/auth');
//       return;
//     }

//     const userId = session.user.id;

//     async function loadProfileData() {
//       setLoading(true);

//       // Wallet
//       const { data: walletData } = await supabase
//         .from('wallets')
//         .select('balance')
//         .eq('user_id', userId)
//         .single();
//       if (walletData) setWallet(walletData);

//       // Profile data
//       const { data: profile } = await supabase
//         .from('profiles') // Assuming you have a profiles table
//         .select('full_name, phone, referral_code')
//         .eq('id', userId)
//         .single();

//       if (profile) {
//         setFullName(profile.full_name || '');
//         setPhone(profile.phone || '');
//         setReferralCode(profile.referral_code || '');
//       }

//       // Recent transactions
//       const { data: txData } = await supabase
//         .from('transactions')
//         .select('amount, type, status, created_at')
//         .eq('user_id', userId)
//         .order('created_at', { ascending: false })
//         .limit(3);

//       setRecentTransactions(txData || []);

//       setLoading(false);
//     }

//     loadProfileData();
//   }, [session, sessionLoading, router]);

//   const saveProfile = async () => {
//     if (!session?.user.id) return;

//     setSaving(true);

//     const { error } = await supabase
//       .from('profiles')
//       .upsert({
//         id: session.user.id,
//         full_name: fullName,
//         phone,
//         updated_at: new Date().toISOString()
//       });

//     if (error) {
//       toast.error('Failed to save profile');
//     } else {
//       toast.success('Profile updated');
//       setIsEditing(false);
//     }

//     setSaving(false);
//   };

//   const generateReferralCode = async () => {
//     if (referralCode) return;

//     const code = Math.random().toString(36).substring(2, 8).toUpperCase();

//     const { error } = await supabase
//       .from('profiles')
//       .update({ referral_code: code })
//       .eq('id', session?.user.id);

//     if (!error) {
//       setReferralCode(code);
//       toast.success('Referral code generated!');
//     }
//   };

//   const copyReferralLink = () => {
//     navigator.clipboard.writeText(referralLink);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };

//   const copyEmail = () => {
//     navigator.clipboard.writeText(session?.user.email || '');
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };

//   const handleLogout = async () => {
//     await supabase.auth.signOut();
//     router.push('/auth');
//   };

//   if (sessionLoading || loading) {
//     return (
//       <div className="min-h-screen bg-brand-primary flex items-center justify-center">
//         <Loader2 className="w-10 h-10 text-brand-mint animate-spin" />
//       </div>
//     );
//   }

//   const joinDate = session?.user.created_at
//     ? new Date(session.user.created_at).toLocaleDateString('en-GB', {
//         day: 'numeric',
//         month: 'long',
//         year: 'numeric'
//       })
//     : 'Unknown';

//   return (
//     <div className="min-h-screen bg-brand-primary text-white">
//       <header className="sticky top-0 z-50 bg-brand-carbon/80 backdrop-blur-xl border-b border-white/5 px-4 py-4">
//         <div className="max-w-4xl mx-auto flex items-center justify-between">
//           <div className="flex items-center gap-4">
//             <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-xl transition">
//               <ArrowLeft size={20} />
//             </Link>
//             <h1 className="text-xl font-bold">My Profile</h1>
//           </div>
//         </div>
//       </header>

//       <main className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-8">
//         {/* Profile Card */}
//         <div className="bg-gradient-to-br from-brand-carbon to-brand-carbon/80 rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl">
//           <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
//             <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-brand-mint/20 border-4 border-brand-mint/30 flex items-center justify-center text-4xl font-bold text-brand-mint">
//               {fullName?.[0]?.toUpperCase() || session?.user.email?.[0]?.toUpperCase() || '?'}
//             </div>

//             <div className="text-center md:text-left flex-1">
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={fullName}
//                   onChange={(e) => setFullName(e.target.value)}
//                   placeholder="Your full name"
//                   className="text-2xl md:text-3xl font-bold bg-transparent border-b border-brand-mint/50 focus:outline-none w-full mb-2"
//                 />
//               ) : (
//                 <h2 className="text-2xl md:text-3xl font-bold mb-2">
//                   {fullName || session?.user.email?.split('@')[0] || 'User'}
//                 </h2>
//               )}

//               <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
//                 <Mail size={18} className="text-brand-gray/70" />
//                 {isEditing ? (
//                   <input
//                     type="email"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     className="bg-transparent border-b border-brand-mint/50 focus:outline-none"
//                     disabled // email usually not editable
//                   />
//                 ) : (
//                   <span className="text-brand-gray/80 font-medium">{session?.user.email}</span>
//                 )}
//                 <button onClick={copyEmail} className="p-1.5 hover:bg-white/5 rounded-lg transition">
//                   {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
//                 </button>
//               </div>

//               <div className="flex flex-wrap gap-6 text-sm">
//                 <div className="flex items-center gap-2">
//                   <Calendar size={16} className="text-brand-gray/70" />
//                   <span>Joined {joinDate}</span>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <Wallet size={16} className="text-brand-gray/70" />
//                   <span className="font-bold cursor-pointer flex items-center gap-1" onClick={() => setShowBalance(!showBalance)}>
//                     Balance: {showBalance ? `₦${wallet?.balance?.toLocaleString() || '0.00'}` : '••••••'}
//                     {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <button
//               onClick={() => {
//                 if (isEditing) saveProfile();
//                 else setIsEditing(true);
//               }}
//               disabled={saving}
//               className="px-5 py-2.5 bg-brand-mint/10 hover:bg-brand-mint/20 text-brand-mint rounded-xl text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
//             >
//               {saving ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
//               {isEditing ? 'Save' : 'Edit Profile'}
//             </button>
//           </div>
//         </div>

//         {/* Referral Section */}
//         <div className="bg-brand-carbon rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl">
//           <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
//             <Zap size={20} className="text-brand-mint" />
//             Referral Program
//           </h3>

//           {referralCode ? (
//             <div className="space-y-4">
//               <div className="flex flex-col sm:flex-row gap-4">
//                 <div className="flex-1">
//                   <label className="block text-sm text-brand-gray/60 mb-1">Your Referral Code</label>
//                   <div className="flex items-center gap-2 bg-brand-primary p-3 rounded-xl border border-white/10">
//                     <span className="font-mono font-bold text-lg">{referralCode}</span>
//                     <button onClick={() => navigator.clipboard.writeText(referralCode)} className="p-2 hover:bg-white/5 rounded-lg">
//                       <Copy size={18} />
//                     </button>
//                   </div>
//                 </div>

//                 <div className="flex-1">
//                   <label className="block text-sm text-brand-gray/60 mb-1">Referral Link</label>
//                   <div className="flex items-center gap-2 bg-brand-primary p-3 rounded-xl border border-white/10">
//                     <span className="font-mono text-sm truncate flex-1">{referralLink}</span>
//                     <button onClick={copyReferralLink} className="p-2 hover:bg-white/5 rounded-lg">
//                       {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
//                     </button>
//                   </div>
//                 </div>
//               </div>

//               <p className="text-sm text-brand-gray/60">
//                 Share this link with friends — earn ₦500 when they sign up and fund their wallet!
//               </p>
//             </div>
//           ) : (
//             <div className="text-center py-6">
//               <p className="text-brand-gray/60 mb-4">Generate your unique referral code to start earning</p>
//               <button
//                 onClick={generateReferralCode}
//                 className="px-6 py-3 bg-brand-mint text-brand-carbon rounded-xl font-bold hover:bg-brand-mint/90 transition"
//               >
//                 Generate Referral Code
//               </button>
//             </div>
//           )}
//         </div>

//         {/* KYC / Verification Status */}
//         <div className="bg-brand-carbon rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl">
//           <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
//             <Shield size={20} className="text-brand-mint" />
//             Verification Status
//           </h3>

//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-3">
//               {kycStatus === 'Verified' ? (
//                 <CheckCircle2 size={24} className="text-green-400" />
//               ) : kycStatus === 'Pending' ? (
//                 <Loader2 size={24} className="text-yellow-400 animate-spin" />
//               ) : (
//                 <XCircle size={24} className="text-red-400" />
//               )}
//               <div>
//                 <p className="font-medium">{kycStatus}</p>
//                 <p className="text-sm text-brand-gray/60">
//                   {(kycStatus === 'Not Verified' || kycStatus === 'Rejected') && 'Verify your identity to unlock higher limits'}
//                 </p>
//               </div>
//             </div>

//             {(kycStatus === 'Not Verified' || kycStatus === 'Pending' || kycStatus === 'Rejected') && (
//               <button className="px-5 py-2 bg-brand-mint/10 hover:bg-brand-mint/20 text-brand-mint rounded-xl text-sm font-medium transition">
//                 Start Verification
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Security & Logout */}
//         <div className="bg-brand-carbon rounded-3xl border border-white/5 overflow-hidden">
//           <div className="p-6 border-b border-white/5">
//             <h3 className="font-bold text-lg flex items-center gap-2">
//               <Shield size={20} className="text-brand-mint" />
//               Security
//             </h3>
//           </div>

//           <div className="divide-y divide-white/5">
//             <div className="p-6 flex items-center justify-between hover:bg-white/5 transition">
//               <div>
//                 <p className="font-medium">Two-Factor Authentication</p>
//                 <p className="text-sm text-brand-gray/60">Add extra security to your account</p>
//               </div>
//               <div className="flex items-center gap-3">
//                 <span className="text-xs text-yellow-400">Coming Soon</span>
//                 <label className="relative inline-flex items-center cursor-not-allowed opacity-50">
//                   <input type="checkbox" className="sr-only peer" disabled />
//                   <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-brand-mint"></div>
//                   <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
//                 </label>
//               </div>
//             </div>

//             <button
//               onClick={handleLogout}
//               className="w-full p-6 flex items-center justify-between text-red-400 hover:bg-red-500/10 transition"
//             >
//               <div className="flex items-center gap-3">
//                 <LogOut size={20} />
//                 <span className="font-medium">Log Out</span>
//               </div>
//               <ChevronRight size={18} />
//             </button>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }


'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, Lock, Bell, Shield, Loader2,
  Check, Eye, EyeOff, ChevronRight, Phone,
  Mail, Camera, LogOut, Trash2, ToggleLeft, ToggleRight,
  Save, AlertTriangle, Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

interface NotifPrefs {
  data_purchase: boolean;
  airtime_purchase: boolean;
  price_updates: boolean;
  new_features: boolean;
  promotions: boolean;
  security_alerts: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  data_purchase: true,
  airtime_purchase: true,
  price_updates: true,
  new_features: true,
  promotions: true,
  security_alerts: true,
};

type Section = 'profile' | 'security' | 'notifications' | 'danger';

export default function SettingsPage() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [profile, setProfile]         = useState<Profile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('profile');

  // Profile form
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [savingPass, setSavingPass]   = useState(false);

  // Notification prefs
  const [notifPrefs, setNotifPrefs]   = useState<NotifPrefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]           = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { router.push('/auth'); return; }
    fetchProfile();
  }, [session, sessionLoading]);

  async function fetchProfile() {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single();
    if (data) {
      setProfile(data);
      setFullName(data.full_name ?? '');
      setPhone(data.phone_number ?? '');
    }
    // Load notif prefs from localStorage for now
    const saved = localStorage.getItem('notif_prefs');
    if (saved) { try { setNotifPrefs(JSON.parse(saved)); } catch {} }
    setLoading(false);
  }

  async function saveProfile() {
    if (!session?.user?.id) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone_number: phone.trim() })
      .eq('id', session.user.id);

    if (error) toast.error('Failed to save profile');
    else toast.success('Profile updated ✓');
    setSavingProfile(false);
  }

  async function changePassword() {
    if (!newPass || newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return; }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) toast.error('Failed: ' + error.message);
    else {
      toast.success('Password updated ✓');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    }
    setSavingPass(false);
  }

  function saveNotifPrefs() {
    setSavingPrefs(true);
    localStorage.setItem('notif_prefs', JSON.stringify(notifPrefs));
    setTimeout(() => {
      setSavingPrefs(false);
      toast.success('Notification preferences saved ✓');
    }, 500);
  }

  function togglePref(key: keyof NotifPrefs) {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth');
  }

  const SECTIONS = [
    { id: 'profile',       label: 'Profile',        icon: User,   desc: 'Name, phone number' },
    { id: 'security',      label: 'Security',        icon: Lock,   desc: 'Password, 2FA' },
    { id: 'notifications', label: 'Notifications',   icon: Bell,   desc: 'What alerts you receive' },
    { id: 'danger',        label: 'Danger Zone',     icon: AlertTriangle, desc: 'Delete account' },
  ];

  if (sessionLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#0D2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 style={{ width: 32, height: 32, color: '#53E6D4', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --primary:#0D2E2E; --carbon:#080C0C; --mint:#53E6D4; --gray:#F4F7F7; --border:rgba(255,255,255,0.07); --font:'Sora',sans-serif; }
        body { background:var(--primary); font-family:var(--font); -webkit-font-smoothing:antialiased; }
        input:focus, textarea:focus { outline:none; }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .spin { animation:spin .8s linear infinite; }
        .nav-item { transition:all .14s; cursor:pointer; }
        .nav-item:hover { background:rgba(83,230,212,0.06) !important; }
        .save-btn { transition:all .15s; }
        .save-btn:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.07); }
        .toggle-row { transition:background .12s; cursor:pointer; }
        .toggle-row:hover { background:rgba(255,255,255,0.03) !important; }
        input[type=password]::-ms-reveal { display:none; }

        /* Responsive */
        @media (max-width: 768px) {
          .settings-layout { flex-direction: column !important; }
          .settings-nav { width: 100% !important; position: static !important; flex-direction: row !important; overflow-x: auto !important; scrollbar-width: none; gap: 6px !important; padding: 12px !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important; }
          .settings-nav::-webkit-scrollbar { display: none; }
          .nav-item { flex-direction: column !important; min-width: 80px !important; padding: 10px 12px !important; border-radius: 12px !important; border: none !important; }
          .nav-item-desc { display: none !important; }
          .nav-chevron { display: none !important; }
          .settings-content { border-radius: 0 !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--primary)', color: 'var(--gray)', fontFamily: 'var(--font)' }}>

        {/* Header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(13,46,46,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px', height: 58, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard"
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(244,247,247,0.6)', textDecoration: 'none', flexShrink: 0 }}>
              <ArrowLeft style={{ width: 17, height: 17 }} />
            </Link>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>Settings</h1>
              <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.4)' }}>{session?.user?.email}</p>
            </div>
            <button onClick={handleLogout}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <LogOut style={{ width: 13, height: 13 }} /> Logout
            </button>
          </div>
        </header>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 80px' }}>
          <div className="settings-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

            {/* ── Nav ── */}
            <div className="settings-nav"
              style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 78, background: 'rgba(8,12,12,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 8 }}>
              {SECTIONS.map(s => {
                const Icon   = s.icon;
                const active = activeSection === s.id;
                const isDanger = s.id === 'danger';
                return (
                  <button key={s.id} className="nav-item"
                    onClick={() => setActiveSection(s.id as Section)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: 'none', background: active ? (isDanger ? 'rgba(248,113,113,0.1)' : 'rgba(83,230,212,0.1)') : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                    <Icon style={{ width: 17, height: 17, color: active ? (isDanger ? '#f87171' : '#53E6D4') : 'rgba(244,247,247,0.45)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: active ? (isDanger ? '#f87171' : '#53E6D4') : 'rgba(244,247,247,0.7)' }}>{s.label}</p>
                      <p className="nav-item-desc" style={{ fontSize: 10, color: 'rgba(244,247,247,0.3)', marginTop: 1 }}>{s.desc}</p>
                    </div>
                    <ChevronRight className="nav-chevron" style={{ width: 14, height: 14, color: 'rgba(244,247,247,0.2)' }} />
                  </button>
                );
              })}
            </div>

            {/* ── Content ── */}
            <div className="settings-content" style={{ flex: 1, minWidth: 0 }}>

              {/* PROFILE */}
              {activeSection === 'profile' && (
                <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 24, animation: 'fadeUp .25s ease' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Profile Information</h2>
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.4)', marginBottom: 24 }}>Update your display name and contact details</p>

                  {/* Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(83,230,212,0.15)', border: '2px solid rgba(83,230,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#53E6D4', flexShrink: 0 }}>
                      {(fullName || session?.user?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#F4F7F7', marginBottom: 3 }}>{fullName || 'Set your name'}</p>
                      <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.4)' }}>{session?.user?.email}</p>
                    </div>
                  </div>

                  {/* Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <FieldGroup label="Full Name" icon={User}>
                      <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name"
                        style={inputStyle} />
                    </FieldGroup>

                    <FieldGroup label="Email Address" icon={Mail}>
                      <input value={session?.user?.email ?? ''} disabled
                        style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                      <p style={{ fontSize: 11, color: 'rgba(244,247,247,0.3)', marginTop: 5 }}>Email cannot be changed</p>
                    </FieldGroup>

                    <FieldGroup label="Phone Number" icon={Phone}>
                      <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="08012345678" type="tel"
                        style={inputStyle} />
                    </FieldGroup>
                  </div>

                  <button className="save-btn" onClick={saveProfile} disabled={savingProfile}
                    style={{ marginTop: 24, padding: '12px 28px', borderRadius: 12, background: '#53E6D4', border: 'none', cursor: savingProfile ? 'not-allowed' : 'pointer', color: '#0D2E2E', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, opacity: savingProfile ? 0.7 : 1, boxShadow: '0 4px 18px rgba(83,230,212,0.25)' }}>
                    {savingProfile ? <><Loader2 style={{ width: 15, height: 15 }} className="spin" /> Saving…</> : <><Save style={{ width: 15, height: 15 }} /> Save Changes</>}
                  </button>
                </div>
              )}

              {/* SECURITY */}
              {activeSection === 'security' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .25s ease' }}>
                  <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 24 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Change Password</h2>
                    <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.4)', marginBottom: 24 }}>Use a strong password of at least 8 characters</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <FieldGroup label="New Password" icon={Lock}>
                        <div style={{ position: 'relative' }}>
                          <input value={newPass} onChange={e => setNewPass(e.target.value)} type={showNew ? 'text' : 'password'} placeholder="Min. 8 characters"
                            style={{ ...inputStyle, paddingRight: 44 }} />
                          <button onClick={() => setShowNew(!showNew)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(244,247,247,0.4)' }}>
                            {showNew ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                          </button>
                        </div>
                        {/* Strength bar */}
                        {newPass && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, newPass.length * 8)}%`, background: newPass.length < 6 ? '#f87171' : newPass.length < 10 ? '#facc15' : '#4ade80', transition: 'all .2s' }} />
                            </div>
                            <p style={{ fontSize: 10, color: newPass.length < 6 ? '#f87171' : newPass.length < 10 ? '#facc15' : '#4ade80', marginTop: 4 }}>
                              {newPass.length < 6 ? 'Weak' : newPass.length < 10 ? 'Medium' : 'Strong'} password
                            </p>
                          </div>
                        )}
                      </FieldGroup>

                      <FieldGroup label="Confirm Password" icon={Lock}>
                        <div style={{ position: 'relative' }}>
                          <input value={confirmPass} onChange={e => setConfirmPass(e.target.value)} type={showCurrent ? 'text' : 'password'} placeholder="Repeat new password"
                            style={{ ...inputStyle, paddingRight: 44, borderColor: confirmPass && confirmPass !== newPass ? 'rgba(248,113,113,0.4)' : undefined }} />
                          <button onClick={() => setShowCurrent(!showCurrent)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(244,247,247,0.4)' }}>
                            {showCurrent ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                          </button>
                        </div>
                        {confirmPass && confirmPass !== newPass && (
                          <p style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>Passwords do not match</p>
                        )}
                        {confirmPass && confirmPass === newPass && (
                          <p style={{ fontSize: 11, color: '#4ade80', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check style={{ width: 11, height: 11 }} /> Passwords match
                          </p>
                        )}
                      </FieldGroup>
                    </div>

                    <button className="save-btn" onClick={changePassword} disabled={savingPass || !newPass || newPass !== confirmPass}
                      style={{ marginTop: 20, padding: '12px 28px', borderRadius: 12, background: newPass && newPass === confirmPass ? '#53E6D4' : 'rgba(255,255,255,0.06)', border: 'none', cursor: savingPass || !newPass ? 'not-allowed' : 'pointer', color: newPass && newPass === confirmPass ? '#0D2E2E' : 'rgba(244,247,247,0.3)', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {savingPass ? <><Loader2 style={{ width: 15, height: 15 }} className="spin" /> Updating…</> : <><Lock style={{ width: 15, height: 15 }} /> Update Password</>}
                    </button>
                  </div>

                  {/* Account info */}
                  <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Account Info</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'User ID', value: session?.user?.id?.slice(0, 16) + '…' },
                        { label: 'Email', value: session?.user?.email },
                        { label: 'Created', value: session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                        { label: 'Last Sign In', value: session?.user?.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(244,247,247,0.5)' }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#F4F7F7', fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS */}
              {activeSection === 'notifications' && (
                <div style={{ background: 'rgba(8,12,12,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 24, animation: 'fadeUp .25s ease' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Notification Preferences</h2>
                  <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.4)', marginBottom: 24 }}>Choose what notifications you want to receive</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { key: 'data_purchase',    label: 'Data Purchase Alerts',  desc: 'Get notified when your data purchase is successful',  color: '#53E6D4' },
                      { key: 'airtime_purchase', label: 'Airtime Purchase Alerts',desc: 'Get notified when your airtime topup is successful',   color: '#4ade80' },
                      { key: 'price_updates',    label: 'Price Updates',          desc: 'When data plan prices change on any network',          color: '#facc15' },
                      { key: 'new_features',     label: 'New Features',           desc: 'When we launch new services or improvements',          color: '#a78bfa' },
                      { key: 'promotions',       label: 'Promotions & Offers',    desc: 'Flash sales, cashback offers, and special deals',       color: '#fb923c' },
                      { key: 'security_alerts',  label: 'Security Alerts',        desc: 'Login activity and account security notifications',     color: '#f87171' },
                    ].map(({ key, label, desc, color }) => {
                      const on = notifPrefs[key as keyof NotifPrefs];
                      return (
                        <div key={key} className="toggle-row"
                          onClick={() => togglePref(key as keyof NotifPrefs)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: 'transparent' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#F4F7F7', marginBottom: 3 }}>{label}</p>
                            <p style={{ fontSize: 12, color: 'rgba(244,247,247,0.4)' }}>{desc}</p>
                          </div>
                          <div style={{ flexShrink: 0, marginLeft: 16 }}>
                            {on
                              ? <ToggleRight style={{ width: 28, height: 28, color }} />
                              : <ToggleLeft  style={{ width: 28, height: 28, color: 'rgba(244,247,247,0.2)' }} />
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button className="save-btn" onClick={saveNotifPrefs} disabled={savingPrefs}
                    style={{ marginTop: 20, padding: '12px 28px', borderRadius: 12, background: '#53E6D4', border: 'none', cursor: 'pointer', color: '#0D2E2E', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 18px rgba(83,230,212,0.25)' }}>
                    {savingPrefs ? <><Loader2 style={{ width: 15, height: 15 }} className="spin" /> Saving…</> : <><Check style={{ width: 15, height: 15 }} /> Save Preferences</>}
                  </button>
                </div>
              )}

              {/* DANGER ZONE */}
              {activeSection === 'danger' && (
                <div style={{ animation: 'fadeUp .25s ease' }}>
                  <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 18, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <AlertTriangle style={{ width: 20, height: 20, color: '#f87171' }} />
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>Danger Zone</h2>
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.5)', marginBottom: 28 }}>
                      These actions are irreversible. Please be absolutely sure before proceeding.
                    </p>

                    {/* Delete account */}
                    <div style={{ background: 'rgba(248,113,113,0.07)', borderRadius: 14, padding: 18, border: '1px solid rgba(248,113,113,0.15)' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f87171', marginBottom: 6 }}>Delete Account</h3>
                      <p style={{ fontSize: 13, color: 'rgba(244,247,247,0.5)', marginBottom: 16, lineHeight: 1.6 }}>
                        This will permanently delete your account, wallet, and all transaction history. This cannot be undone.
                      </p>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(244,247,247,0.6)', marginBottom: 8 }}>
                        Type <span style={{ color: '#f87171', fontFamily: 'monospace' }}>DELETE</span> to confirm:
                      </p>
                      <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE here"
                        style={{ ...inputStyle, borderColor: 'rgba(248,113,113,0.3)', marginBottom: 14 }} />
                      <button disabled={deleteConfirm !== 'DELETE' || deleting}
                        style={{ padding: '11px 20px', borderRadius: 11, background: deleteConfirm === 'DELETE' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${deleteConfirm === 'DELETE' ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.07)'}`, cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', color: deleteConfirm === 'DELETE' ? '#f87171' : 'rgba(244,247,247,0.3)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                        {deleting ? 'Deleting…' : 'Delete My Account'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Reusable field group
function FieldGroup({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,247,247,0.4)', textTransform: 'uppercase', letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <Icon style={{ width: 12, height: 12 }} /> {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#F4F7F7', fontSize: 14, fontFamily: "'Sora', sans-serif", boxSizing: 'border-box',
};