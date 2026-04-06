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

    // Update wallet balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ wallet_balance: new_balance })
      .eq('id', user_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log the adjustment in a wallet_logs table if you have one (optional)
    await supabase.from('wallet_logs').insert({
      user_id,
      amount,
      type,
      reason: reason || null,
      balance_after: new_balance,
      created_by: 'admin',
    }).then(() => {}); // fire and forget — no error if table doesn't exist

    return NextResponse.json({ success: true, new_balance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}