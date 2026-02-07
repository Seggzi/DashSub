import { supabase } from '@/lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Verify signature (Monnify sends in header)
  const signature = req.headers.get('monnify-signature');
  // Implement verification later — for now just process

  if (body.event === 'reserved.account.transaction') {
    const { transaction } = body.data;

    const accountRef = transaction.accountReference;
    const amount = transaction.amount / 100;

    // Find user by account reference
    const { data: va } = await supabase
      .from('virtual_accounts')
      .select('user_id')
      .eq('account_reference', accountRef)
      .single();

    if (!va) return NextResponse.json({ success: false });

    // Credit wallet
    await supabase.rpc('add_to_wallet', {
      target_user_id: va.user_id,
      amount_to_add: amount,
    });

    // Notification
    await supabase.from('notifications').insert({
      user_id: va.user_id,
      title: 'Deposit Received',
      message: `₦${amount.toLocaleString()} added to your wallet via bank transfer.`,
      type: 'success',
      category: 'funding',
      action_url: '/dashboard/transactions',
    });
  }

  return NextResponse.json({ success: true });
}