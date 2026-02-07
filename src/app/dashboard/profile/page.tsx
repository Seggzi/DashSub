'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Wallet, Calendar, Mail, Shield, LogOut,
  Edit2, Eye, EyeOff, Copy, Check, ArrowLeft,
  Loader2, History, CheckCircle2, XCircle, Info,
  Zap,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { session, isLoading: sessionLoading } = useSupabaseSession();
  const router = useRouter();

  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  // Editable profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(session?.user.email || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Referral
  const [referralCode, setReferralCode] = useState('');
  const referralLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';

  // KYC status (placeholder - later can come from DB)
  const [kycStatus, setKycStatus] = useState<'Not Verified' | 'Pending' | 'Verified' | 'Rejected'>('Not Verified');

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/auth');
      return;
    }

    const userId = session.user.id;

    async function loadProfileData() {
      setLoading(true);

      // Wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();
      if (walletData) setWallet(walletData);

      // Profile data
      const { data: profile } = await supabase
        .from('profiles') // Assuming you have a profiles table
        .select('full_name, phone, referral_code')
        .eq('id', userId)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setReferralCode(profile.referral_code || '');
      }

      // Recent transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('amount, type, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      setRecentTransactions(txData || []);

      setLoading(false);
    }

    loadProfileData();
  }, [session, sessionLoading, router]);

  const saveProfile = async () => {
    if (!session?.user.id) return;

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        full_name: fullName,
        phone,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile updated');
      setIsEditing(false);
    }

    setSaving(false);
  };

  const generateReferralCode = async () => {
    if (referralCode) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', session?.user.id);

    if (!error) {
      setReferralCode(code);
      toast.success('Referral code generated!');
    }
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(session?.user.email || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-mint animate-spin" />
      </div>
    );
  }

  const joinDate = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'Unknown';

  return (
    <div className="min-h-screen bg-brand-primary text-white">
      <header className="sticky top-0 z-50 bg-brand-carbon/80 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-xl transition">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-8">
        {/* Profile Card */}
        <div className="bg-gradient-to-br from-brand-carbon to-brand-carbon/80 rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-brand-mint/20 border-4 border-brand-mint/30 flex items-center justify-center text-4xl font-bold text-brand-mint">
              {fullName?.[0]?.toUpperCase() || session?.user.email?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="text-center md:text-left flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="text-2xl md:text-3xl font-bold bg-transparent border-b border-brand-mint/50 focus:outline-none w-full mb-2"
                />
              ) : (
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  {fullName || session?.user.email?.split('@')[0] || 'User'}
                </h2>
              )}

              <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
                <Mail size={18} className="text-brand-gray/70" />
                {isEditing ? (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-transparent border-b border-brand-mint/50 focus:outline-none"
                    disabled // email usually not editable
                  />
                ) : (
                  <span className="text-brand-gray/80 font-medium">{session?.user.email}</span>
                )}
                <button onClick={copyEmail} className="p-1.5 hover:bg-white/5 rounded-lg transition">
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>

              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-brand-gray/70" />
                  <span>Joined {joinDate}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-brand-gray/70" />
                  <span className="font-bold cursor-pointer flex items-center gap-1" onClick={() => setShowBalance(!showBalance)}>
                    Balance: {showBalance ? `₦${wallet?.balance?.toLocaleString() || '0.00'}` : '••••••'}
                    {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (isEditing) saveProfile();
                else setIsEditing(true);
              }}
              disabled={saving}
              className="px-5 py-2.5 bg-brand-mint/10 hover:bg-brand-mint/20 text-brand-mint rounded-xl text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
              {isEditing ? 'Save' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Referral Section */}
        <div className="bg-brand-carbon rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Zap size={20} className="text-brand-mint" />
            Referral Program
          </h3>

          {referralCode ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-brand-gray/60 mb-1">Your Referral Code</label>
                  <div className="flex items-center gap-2 bg-brand-primary p-3 rounded-xl border border-white/10">
                    <span className="font-mono font-bold text-lg">{referralCode}</span>
                    <button onClick={() => navigator.clipboard.writeText(referralCode)} className="p-2 hover:bg-white/5 rounded-lg">
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-sm text-brand-gray/60 mb-1">Referral Link</label>
                  <div className="flex items-center gap-2 bg-brand-primary p-3 rounded-xl border border-white/10">
                    <span className="font-mono text-sm truncate flex-1">{referralLink}</span>
                    <button onClick={copyReferralLink} className="p-2 hover:bg-white/5 rounded-lg">
                      {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-brand-gray/60">
                Share this link with friends — earn ₦500 when they sign up and fund their wallet!
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-brand-gray/60 mb-4">Generate your unique referral code to start earning</p>
              <button
                onClick={generateReferralCode}
                className="px-6 py-3 bg-brand-mint text-brand-carbon rounded-xl font-bold hover:bg-brand-mint/90 transition"
              >
                Generate Referral Code
              </button>
            </div>
          )}
        </div>

        {/* KYC / Verification Status */}
        <div className="bg-brand-carbon rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield size={20} className="text-brand-mint" />
            Verification Status
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {kycStatus === 'Verified' ? (
                <CheckCircle2 size={24} className="text-green-400" />
              ) : kycStatus === 'Pending' ? (
                <Loader2 size={24} className="text-yellow-400 animate-spin" />
              ) : (
                <XCircle size={24} className="text-red-400" />
              )}
              <div>
                <p className="font-medium">{kycStatus}</p>
                <p className="text-sm text-brand-gray/60">
                  {(kycStatus === 'Not Verified' || kycStatus === 'Rejected') && 'Verify your identity to unlock higher limits'}
                </p>
              </div>
            </div>

            {(kycStatus === 'Not Verified' || kycStatus === 'Pending' || kycStatus === 'Rejected') && (
              <button className="px-5 py-2 bg-brand-mint/10 hover:bg-brand-mint/20 text-brand-mint rounded-xl text-sm font-medium transition">
                Start Verification
              </button>
            )}
          </div>
        </div>

        {/* Security & Logout */}
        <div className="bg-brand-carbon rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Shield size={20} className="text-brand-mint" />
              Security
            </h3>
          </div>

          <div className="divide-y divide-white/5">
            <div className="p-6 flex items-center justify-between hover:bg-white/5 transition">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-brand-gray/60">Add extra security to your account</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-yellow-400">Coming Soon</span>
                <label className="relative inline-flex items-center cursor-not-allowed opacity-50">
                  <input type="checkbox" className="sr-only peer" disabled />
                  <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-brand-mint"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
                </label>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full p-6 flex items-center justify-between text-red-400 hover:bg-red-500/10 transition"
            >
              <div className="flex items-center gap-3">
                <LogOut size={20} />
                <span className="font-medium">Log Out</span>
              </div>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}