import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Step 1: fetch transactions (no join — no FK relationship exists)
    const { data: txData, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Transactions fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Step 2: get unique user IDs
    const userIds = [...new Set(
      (txData || []).map((t: any) => t.user_id).filter(Boolean)
    )];

    // Step 3: fetch profiles for those users
    let profileMap: Record<string, { full_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      (profileData || []).forEach((p: any) => {
        profileMap[p.id] = { full_name: p.full_name ?? '', email: p.email ?? '' };
      });
    }

    // Step 4: merge profiles into transactions
    const data = (txData || []).map((tx: any) => ({
      ...tx,
      profiles: profileMap[tx.user_id] ?? null,
    }));

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Transactions API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}