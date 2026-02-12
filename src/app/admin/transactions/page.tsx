'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Search, Download, Filter } from 'lucide-react';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  reference: string;
  created_at: string;
  phone_number?: string;
  network?: string;
  user: {
    full_name: string;
    email: string;
  };
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data: txData } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Get emails
      const transactionsWithEmails = await Promise.all(
        (txData || []).map(async (tx) => {
          const { data: authUser } = await supabase.auth.admin.getUserById(tx.user_id);
          
          return {
            ...tx,
            user: {
              full_name: (tx.profiles as any)?.full_name || 'Unknown',
              email: authUser?.user?.email || 'N/A',
            },
          };
        })
      );

      setTransactions(transactionsWithEmails as any);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.reference.toLowerCase().includes(search.toLowerCase()) ||
      tx.user.full_name.toLowerCase().includes(search.toLowerCase()) ||
      tx.user.email.toLowerCase().includes(search.toLowerCase()) ||
      tx.phone_number?.includes(search);

    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-brand-mint">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Transactions</h1>
        <p className="text-brand-gray/60">View all platform transactions</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="w-full bg-brand-primary border border-brand-mint/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-brand-mint"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-brand-primary border border-brand-mint/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-mint"
        >
          <option value="all">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="airtime">Airtime</option>
          <option value="data">Data</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-brand-primary border border-brand-mint/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-mint"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-brand-primary border border-brand-mint/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-carbon/50 border-b border-brand-mint/10">
              <tr>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">User</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Type</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Amount</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Status</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-brand-mint/5 hover:bg-brand-mint/5 transition-all"
                >
                  <td className="p-4">
                    <div>
                      <p className="font-semibold text-white">{tx.user.full_name}</p>
                      <p className="text-xs text-brand-gray/60">{tx.user.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-brand-mint/10 text-brand-mint rounded-lg text-sm font-bold uppercase">
                      {tx.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-white">₦{tx.amount.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                        tx.status === 'success'
                          ? 'bg-green-500/20 text-green-400'
                          : tx.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-brand-gray/60">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12 text-brand-gray/60">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}