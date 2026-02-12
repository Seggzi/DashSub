'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import {
  DollarSign,
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ServicePrice {
  id: string;
  service_type: string;
  provider: string;
  base_price: number;
  selling_price: number;
  commission_percentage: number;
  is_active: boolean;
}

export default function AdminPricing() {
  const { session } = useSupabaseSession();
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ServicePrice>>({});

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const { data } = await supabase
        .from('service_pricing')
        .select('*')
        .order('service_type', { ascending: true });

      setPrices(data || []);
    } catch (error) {
      console.error('Error loading prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (price: ServicePrice) => {
    setEditingId(price.id);
    setEditForm(price);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.selling_price) return;

    try {
      // Calculate commission percentage
      const commissionPercentage = editForm.base_price
        ? ((editForm.selling_price - editForm.base_price) / editForm.base_price) * 100
        : 0;

      const { error } = await supabase
        .from('service_pricing')
        .update({
          selling_price: editForm.selling_price,
          commission_percentage: commissionPercentage,
          updated_at: new Date().toISOString(),
          updated_by: session?.user?.id,
        })
        .eq('id', editingId);

      if (error) throw error;

      toast.success('Price updated successfully!');
      setEditingId(null);
      setEditForm({});
      loadPrices();

      // Update data_plans table if it's a data service
      if (editForm.service_type === 'data') {
        await updateDataPlans(editForm.provider!, commissionPercentage / 100);
      }
    } catch (error: any) {
      console.error('Error updating price:', error);
      toast.error('Failed to update price');
    }
  };

  const updateDataPlans = async (network: string, markupMultiplier: number) => {
    try {
      // Get network ID mapping
      const networkMap: { [key: string]: string } = {
        'mtn': '01',
        'glo': '02',
        '9mobile': '03',
        'airtel': '04',
      };

      const networkId = networkMap[network.toLowerCase()];
      if (!networkId) return;

      // Get all plans for this network
      const { data: plans } = await supabase
        .from('data_plans')
        .select('*')
        .eq('network_id', networkId);

      if (!plans) return;

      // Update each plan with new pricing
      const updates = plans.map((plan) => ({
        id: plan.id,
        selling_price: Math.ceil(plan.cost_price * (1 + markupMultiplier)),
      }));

      for (const update of updates) {
        await supabase
          .from('data_plans')
          .update({ selling_price: update.selling_price })
          .eq('id', update.id);
      }

      toast.success(`Updated ${plans.length} data plans for ${network.toUpperCase()}`);
    } catch (error) {
      console.error('Error updating data plans:', error);
    }
  };

  const syncDataPlans = async () => {
    try {
      toast.info('Syncing data plans from Clubkonnect...');
      
      const response = await fetch('/api/admin/sync-data-plans', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        loadPrices();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to sync data plans');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-brand-mint">Loading pricing...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Service Pricing</h1>
          <p className="text-brand-gray/60">Manage service prices and commissions</p>
        </div>
        <button
          onClick={syncDataPlans}
          className="flex items-center gap-2 px-4 py-2 bg-brand-mint text-brand-carbon rounded-xl font-bold hover:shadow-lg transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Sync Data Plans
        </button>
      </div>

      {/* Pricing Table */}
      <div className="bg-brand-primary border border-brand-mint/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-carbon/50 border-b border-brand-mint/10">
              <tr>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Service</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Provider</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Base Price</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Selling Price</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Commission</th>
                <th className="text-left p-4 text-brand-gray/60 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((price) => {
                const isEditing = editingId === price.id;

                return (
                  <tr
                    key={price.id}
                    className="border-b border-brand-mint/5 hover:bg-brand-mint/5 transition-all"
                  >
                    <td className="p-4">
                      <span className="px-3 py-1 bg-brand-mint/10 text-brand-mint rounded-lg text-sm font-bold uppercase">
                        {price.service_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-white font-semibold uppercase">
                        {price.provider}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-brand-gray/80">
                        ₦{price.base_price.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.selling_price || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, selling_price: Number(e.target.value) })
                          }
                          className="w-32 bg-brand-carbon border border-brand-mint/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-mint"
                        />
                      ) : (
                        <span className="font-bold text-brand-mint">
                          ₦{price.selling_price.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-green-400 font-semibold">
                        {price.commission_percentage.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEdit}
                            className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(price)}
                          className="p-2 bg-brand-mint/10 text-brand-mint rounded-lg hover:bg-brand-mint/20 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-6 bg-brand-mint/10 border border-brand-mint/20 rounded-2xl">
        <h3 className="text-lg font-bold text-brand-mint mb-2">💡 How it works</h3>
        <ul className="space-y-2 text-sm text-brand-gray/80">
          <li>• <strong>Base Price:</strong> The cost price from providers (Clubkonnect, etc.)</li>
          <li>• <strong>Selling Price:</strong> What customers pay on your platform</li>
          <li>• <strong>Commission:</strong> Your profit percentage (auto-calculated)</li>
          <li>• Editing data prices will update ALL plans for that network</li>
          <li>• Click "Sync Data Plans" to fetch latest plans from Clubkonnect</li>
        </ul>
      </div>
    </div>
  );
}