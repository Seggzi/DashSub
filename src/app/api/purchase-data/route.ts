import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GLADTIDINGS_TOKEN = process.env.GLADTIDINGS_TOKEN ?? '';

async function purchaseDataWithGladTidings(
  networkId: string,
  phoneNumber: string,
  planCode: string,
  reference: string
) {
  const res = await fetch('https://www.gladtidingsdata.com/api/data/', {
    method: 'POST',
    headers: {
      Authorization: `Token ${GLADTIDINGS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      network: parseInt(networkId),
      mobile_number: phoneNumber,
      plan: parseInt(planCode),
      Ported_number: true,
      ident: reference,
    }),
  });

  const data = await res.json();
  console.log('📡 GladTidings response:', data);

  const isSuccess =
    data.Status === 'successful' ||
    data.status === 'successful' ||
    res.status === 201;

  return {
    success: isSuccess,
    message: isSuccess ? 'Data delivered successfully' : (data.Status || data.message || 'Purchase failed'),
    provider_reference: String(data.id ?? ''),
    provider_response: data,
  };
}

export async function POST(request: NextRequest) {
  console.log('\n🔔 New data purchase request (GladTidings)');

  try {
    const body = await request.json();
    const { userId, phoneNumber, planCode, network, networkCode, reference } = body;

    console.log('📥 Request:', { userId, phoneNumber, planCode, network, reference });

    if (!userId || !phoneNumber || !planCode || !reference) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get plan from DB
    const { data: plan, error: planError } = await supabase
      .from('data_plans')
      .select('*')
      .eq('network_id', network)
      .eq('plan_code', planCode)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { success: false, message: 'Plan not found or inactive' },
        { status: 400 }
      );
    }

    // Check wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ success: false, message: 'Wallet not found' }, { status: 500 });
    }

    if (wallet.balance < plan.selling_price) {
      return NextResponse.json(
        { success: false, message: `Insufficient balance. You need ₦${plan.selling_price.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Create transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: plan.selling_price,
        type: 'data',
        status: 'pending',
        reference,
        phone_number: phoneNumber,
        network,
        plan_code: planCode,
      })
      .select()
      .single();

    if (txError || !transaction) {
      return NextResponse.json({ success: false, message: 'Failed to create transaction' }, { status: 500 });
    }

    // Call GladTidings
    let providerResult;
    try {
      providerResult = await purchaseDataWithGladTidings(
        network,       // network_id from data_plans e.g. "1"
        phoneNumber,
        planCode,      // plan_code = GladTidings plan ID
        reference
      );
    } catch (err: any) {
      await supabase.from('transactions').update({ status: 'failed' }).eq('id', transaction.id);
      return NextResponse.json({ success: false, message: 'Provider error: ' + err.message }, { status: 500 });
    }

    if (providerResult.success) {
      const newBalance = wallet.balance - plan.selling_price;

      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', userId);

      if (deductError) {
        await supabase.from('transactions').update({ status: 'failed' }).eq('id', transaction.id);
        return NextResponse.json({ success: false, message: 'Failed to deduct wallet. Contact support.' }, { status: 500 });
      }

      await supabase
        .from('transactions')
        .update({ status: 'success', provider_reference: providerResult.provider_reference })
        .eq('id', transaction.id);

      console.log(`🎉 Done! User paid: ₦${plan.selling_price} | Cost: ₦${plan.cost_price} | Profit: ₦${plan.selling_price - plan.cost_price}`);

      return NextResponse.json({
        success: true,
        message: providerResult.message,
        new_balance: newBalance,
        transaction_id: transaction.id,
      });

    } else {
      await supabase.from('transactions').update({ status: 'failed' }).eq('id', transaction.id);
      return NextResponse.json({ success: false, message: providerResult.message }, { status: 400 });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Internal error: ' + error.message }, { status: 500 });
  }
}