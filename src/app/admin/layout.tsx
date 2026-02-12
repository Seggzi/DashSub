'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading } = useSupabaseSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

 useEffect(() => {
  const checkAdminStatus = async () => {
    // Skip check for login page
    if (pathname === '/admin/login') {
      setCheckingAdmin(false);
      return;
    }

    console.log('🔍 Checking admin status...', { session: !!session, userId: session?.user?.id });

    if (!session?.user?.id) {
      console.log('❌ No session, redirecting to login');
      router.push('/admin/login');
      return;
    }

    try {
      // Check if user is admin
      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      console.log('Admin check result:', { adminUser, error });

      if (error || !adminUser) {
        console.log('❌ Not an admin, redirecting to login');
        toast.error('Access denied: Admin only');
        await supabase.auth.signOut();
        router.push('/admin/login');
        return;
      }

      console.log('✅ Admin verified');
      setIsAdmin(true);
    } catch (err) {
      console.error('Error checking admin status:', err);
      router.push('/admin/login');
    } finally {
      setCheckingAdmin(false);
    }
  };

  if (!isLoading) {
    checkAdminStatus();
  }
}, [session, isLoading, router, pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // Render login page without layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (isLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-brand-carbon flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-brand-mint mx-auto mb-4 animate-pulse" />
          <p className="text-brand-gray">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Transactions', href: '/admin/transactions', icon: CreditCard },
    { name: 'Pricing', href: '/admin/pricing', icon: DollarSign },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-brand-carbon">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-brand-primary rounded-lg border border-brand-mint/20"
        >
          {sidebarOpen ? (
            <X className="w-6 h-6 text-brand-mint" />
          ) : (
            <Menu className="w-6 h-6 text-brand-mint" />
          )}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-brand-primary border-r border-brand-mint/10 transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20'
        } overflow-hidden`}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-brand-mint rounded-lg">
              <Shield className="w-6 h-6 text-brand-carbon" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-brand-gray/60">DashSub</p>
              </div>
            )}
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                    isActive
                      ? 'bg-brand-mint/10 text-brand-mint'
                      : 'text-brand-gray/80 hover:bg-brand-mint/10 hover:text-brand-mint'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {sidebarOpen && <span className="font-medium">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all w-full"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        }`}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}