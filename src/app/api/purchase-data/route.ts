import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function purchaseDataWithClubkonnect(
  networkCode: string,
  phoneNumber: string,
  planCode: string,
  reference: string
) {
  const CLUBKONNECT_USER_ID = process.env.CLUBKONNECT_USER_ID;
  const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY;
  const CLUBKONNECT_BASE_URL = 'https://www.nellobytesystems.com';
  
  if (!CLUBKONNECT_USER_ID || !CLUBKONNECT_API_KEY) {
    throw new Error('Clubkonnect credentials not configured');
  }

  const url = new URL(`${CLUBKONNECT_BASE_URL}/APIDatabundleV1.asp`);
  url.searchParams.append('UserID', CLUBKONNECT_USER_ID);
  url.searchParams.append('APIKey', CLUBKONNECT_API_KEY);
  url.searchParams.append('MobileNetwork', networkCode);
  url.searchParams.append('DataPlan', planCode);
  url.searchParams.append('MobileNumber', phoneNumber);
  url.searchParams.append('RequestID', reference);

  console.log('📡 Calling Clubkonnect:', {
    network: networkCode,
    plan: planCode,
    phone: phoneNumber,
  });

  const response = await fetch(url.toString());
  const data = await response.json();

  console.log('📡 Clubkonnect response:', data);

  const isSuccess = 
    data.status === 'ORDER_RECEIVED' || 
    data.statuscode === '100' ||
    data.status === 'ORDER_COMPLETED' ||
    data.statuscode === '200';

  return {
    success: isSuccess,
    message: isSuccess ? 'Data delivered successfully' : (data.status || 'Purchase failed'),
    provider_reference: data.orderid,
    provider_response: data,
  };
}

export async function POST(request: NextRequest) {
  console.log('\n🔔 New data purchase request');
  
  try {
    const body = await request.json();
    const { userId, phoneNumber, planCode, network, networkCode, reference } = body;

    console.log('📥 Request:', { userId, phoneNumber, planCode, network, networkCode, reference });

    // Validation
    if (!userId || !phoneNumber || !planCode || !reference || !networkCode) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get plan details from database
    const { data: plan, error: planError } = await supabase
      .from('data_plans')
      .select('*')
      .eq('network_id', network)
      .eq('plan_code', planCode)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      console.error('❌ Plan not found:', planError);
      return NextResponse.json(
        { success: false, message: 'Plan not found or inactive' },
        { status: 400 }
      );
    }

    console.log('💰 Plan Details:');
    console.log(`   Name: ${plan.plan_name}`);
    console.log(`   Cost Price: ₦${plan.cost_price}`);
    console.log(`   Selling Price: ₦${plan.selling_price}`);
    console.log(`   Your Profit: ₦${plan.selling_price - plan.cost_price}`);

    // Check wallet balance (user pays SELLING price)
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      console.error('❌ Wallet error:', walletError);
      return NextResponse.json(
        { success: false, message: 'Wallet not found' },
        { status: 500 }
      );
    }

    console.log(`💵 User balance: ₦${wallet.balance}`);

    if (wallet.balance < plan.selling_price) {
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient balance. You need ₦${plan.selling_price.toLocaleString()}`
        },
        { status: 400 }
      );
    }

    // Create transaction with SELLING price
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: plan.selling_price, // User pays selling price
        type: 'data',
        status: 'pending',
        reference: reference,
        phone_number: phoneNumber,
        network: network,
        plan_code: planCode,
      })
      .select()
      .single();

    if (txError) {
      console.error('❌ Transaction error:', txError);
      return NextResponse.json(
        { success: false, message: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    console.log('✅ Transaction created');

    // Purchase from Clubkonnect (they receive COST price, you keep profit)
    let providerResult;
    try {
      providerResult = await purchaseDataWithClubkonnect(
        networkCode,
        phoneNumber,
        planCode,
        reference
      );
    } catch (error: any) {
      console.error('❌ Provider error:', error);
      
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id);

      return NextResponse.json(
        { success: false, message: 'Provider error: ' + error.message },
        { status: 500 }
      );
    }

    console.log('📡 Provider result:', providerResult);

    if (providerResult.success) {
      console.log('💸 Deducting from user wallet...');

      // Deduct SELLING price from user wallet
      const newBalance = wallet.balance - plan.selling_price;
      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', userId);

      if (deductError) {
        console.error('❌ Deduction error:', deductError);
        
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);

        return NextResponse.json(
          { success: false, message: 'Failed to deduct from wallet. Contact support.' },
          { status: 500 }
        );
      }

      console.log(`✅ New balance: ₦${newBalance}`);

      // Update transaction to success
      await supabase
        .from('transactions')
        .update({
          status: 'success',
          provider_reference: providerResult.provider_reference,
        })
        .eq('id', transaction.id);

      console.log('🎉 Data purchase completed!');
      console.log(`💵 User paid: ₦${plan.selling_price}`);
      console.log(`💸 Provider cost: ₦${plan.cost_price}`);
      console.log(`💰 Your profit: ₦${plan.selling_price - plan.cost_price}`);

      return NextResponse.json({
        success: true,
        message: providerResult.message,
        new_balance: newBalance,
        transaction_id: transaction.id,
      });
    } else {
      console.error('❌ Provider failed:', providerResult.message);
      
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id);

      return NextResponse.json(
        { success: false, message: providerResult.message },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error: ' + error.message },
      { status: 500 }
    );
  }
}