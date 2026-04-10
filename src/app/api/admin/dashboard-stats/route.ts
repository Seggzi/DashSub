import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // 7 days ago for chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysISO = sevenDaysAgo.toISOString().slice(0, 10) + 'T00:00:00.000Z';

    const [
      { data: allProfiles },
      { data: allTx },
      { data: todayTx },
      { data: lowBalUsers },
      { data: recentTx },
      { data: weekTx },
      { data: networkTx },
    ] = await Promise.all([
      // All profiles for user count
      supabase.from('profiles').select('id, created_at'),

      // All transactions for stats
      supabase.from('transactions').select('amount, status'),

      // Today's transactions
      supabase.from('transactions').select('amount, status').gte('created_at', todayISO),

      // Low balance users — join wallets
      supabase.from('wallets').select('user_id, balance').lt('balance', 500).order('balance', { ascending: true }).limit(8),

      // Recent 10 transactions with user info
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(10),

      // 7-day revenue transactions
      supabase.from('transactions').select('amount, status, created_at').eq('status', 'success').gte('created_at', sevenDaysISO),

      // Network breakdown
      supabase.from('transactions').select('network, amount, status').eq('status', 'success'),
    ]);

    // ── Stats ──────────────────────────────────────────────────────────────
    const totalUsers    = allProfiles?.length ?? 0;
    const today0        = new Date(); today0.setHours(0,0,0,0);
    const newUsersToday = (allProfiles || []).filter(p => new Date(p.created_at) >= today0).length;
    const successTx     = (allTx || []).filter(t => t.status === 'success');
    const revenue       = successTx.reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
    const revenueToday  = (todayTx || []).filter((t: any) => t.status === 'success').reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
    const successRate   = allTx?.length ? Math.round((successTx.length / allTx.length) * 100) : 0;
    const avgOrderValue = successTx.length > 0 ? Math.round(revenue / successTx.length) : 0;
    const pendingCount  = (allTx || []).filter((t: any) => t.status === 'pending').length;

    // ── Low balance — get profile info ─────────────────────────────────────
    const lowBalUserIds = (lowBalUsers || []).map((w: any) => w.user_id);
    let lowBalProfiles: any[] = [];
    if (lowBalUserIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', lowBalUserIds);
      lowBalProfiles = data || [];
    }
    const profileMap: Record<string, any> = {};
    lowBalProfiles.forEach((p: any) => { profileMap[p.id] = p; });

    const lowBalance = (lowBalUsers || []).map((w: any) => ({
      id:             w.user_id,
      wallet_balance: w.balance,
      full_name:      profileMap[w.user_id]?.full_name ?? 'Unnamed',
      email:          profileMap[w.user_id]?.email ?? '',
    }));

    // ── Recent transactions — get profile info ─────────────────────────────
    const recentUserIds = [...new Set((recentTx || []).map((t: any) => t.user_id).filter(Boolean))];
    let recentProfiles: any[] = [];
    if (recentUserIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', recentUserIds);
      recentProfiles = data || [];
    }
    const recentProfileMap: Record<string, any> = {};
    recentProfiles.forEach((p: any) => { recentProfileMap[p.id] = p; });

    const transactions = (recentTx || []).map((tx: any) => ({
      ...tx,
      profiles: recentProfileMap[tx.user_id] ?? null,
    }));

    // ── Network breakdown ──────────────────────────────────────────────────
    const netMap: Record<string, { count: number; revenue: number }> = {};
    (networkTx || []).forEach((t: any) => {
      const key = normalizeNetwork(t.network);
      if (!netMap[key]) netMap[key] = { count: 0, revenue: 0 };
      netMap[key].count++;
      netMap[key].revenue += t.amount ?? 0;
    });
    const networkData = Object.entries(netMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── 7-day revenue ──────────────────────────────────────────────────────
    const weekData = (weekTx || []).map((tx: any) => ({
      amount:     tx.amount,
      created_at: tx.created_at,
    }));

    return NextResponse.json({
      stats: {
        totalUsers, newUsersToday,
        totalRevenue: revenue, revenueToday,
        totalTransactions: allTx?.length ?? 0,
        txToday: todayTx?.length ?? 0,
        successRate, lowBalanceCount: lowBalance.length,
        avgOrderValue, pendingCount,
      },
      transactions,
      lowBalance,
      networkData,
      weekData,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function normalizeNetwork(raw: string | null | undefined): string {
  if (!raw) return 'UNKNOWN';
  const v = raw.trim().toUpperCase();
  if (v === 'MTN') return 'MTN';
  if (v === 'GLO') return 'GLO';
  if (v === 'AIRTEL' || v === '02') return 'AIRTEL';
  if (v === '9MOBILE' || v === '01' || v === '1') return '9MOBILE';
  return 'UNKNOWN';
}