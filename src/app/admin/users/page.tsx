'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Search, UserCircle, Mail, Calendar, Wallet } from 'lucide-react';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  phone_number: string | null;
  created_at: string;
  wallet_balance: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // Get all users with their wallet balance
      const { data: profiles } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone_number,
          created_at,
          wallets (balance)
        `)
        .order('created_at', { ascending: false });

      // Get emails from auth.users
      const usersWithEmails = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: authUser?.user?.email || 'N/A',
            phone_number: profile.phone_number,
            created_at: profile.created_at,
            wallet_balance: (profile.wallets as any)?.[0]?.balance || 0,
          };
        })
      );

      setUsers(usersWithEmails);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.phone_number?.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-brand-mint">Loading users...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Users</h1>
        <p className="text-brand-gray/60">Manage all registered users</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full bg-brand-primary border border-brand-mint/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-brand-mint transition-all"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-brand-primary border border-brand-mint/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-carbon/50 border-b border-brand-mint/10">
              <tr>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">User</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Contact</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Balance</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-brand-mint/5 hover:bg-brand-mint/5 transition-all"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-mint/10 rounded-full">
                        <UserCircle className="w-5 h-5 text-brand-mint" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {user.full_name || 'Unnamed User'}
                        </p>
                        <p className="text-xs text-brand-gray/60">{user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Mail className="w-4 h-4 text-brand-gray/40" />
                        {user.email}
                      </div>
                      {user.phone_number && (
                        <p className="text-sm text-brand-gray/60">{user.phone_number}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-brand-mint" />
                      <span className="font-bold text-brand-mint">
                        ₦{user.wallet_balance.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-brand-gray/60">
                      <Calendar className="w-4 h-4" />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-brand-gray/60">
            No users found
          </div>
        )}
      </div>
    </div>
  );
}