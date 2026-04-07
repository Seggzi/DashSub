import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user_id, amount, type, reason, new_balance } = await request.json();

    if (!user_id || !amount || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!['credit', 'debit'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (typeof new_balance !== 'number' || new_balance < 0) {
      return NextResponse.json({ error: 'Invalid balance' }, { status: 400 });
    }

    // FIX: update wallets table (not profiles.wallet_balance)
    const { error: walletError } = await supabase
      .from('wallets')
      .update({ balance: new_balance, updated_at: new Date().toISOString() })
      .eq('user_id', user_id);

    if (walletError) {
      // If no wallet row exists yet, insert one
      const { error: insertError } = await supabase
        .from('wallets')
        .insert({ user_id, balance: new_balance });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Log to wallet_logs if table exists (fire and forget)
    supabase.from('wallet_logs').insert({
      user_id,
      amount,
      type,
      reason: reason || null,
      balance_after: new_balance,
      created_by: 'admin',
    }).then(() => {});

    return NextResponse.json({ success: true, new_balance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}