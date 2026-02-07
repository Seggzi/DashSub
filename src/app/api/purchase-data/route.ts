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

const COMMISSION_RATE = 0.02;

function calculateCommission(amount: number): number {
  return Math.ceil(amount * COMMISSION_RATE);
}

async function purchaseDataWithClubkonnect(
  networkCode: string,
  phoneNumber: string,
  planCode: string,
  reference: string
) {
  const CLUBKONNECT_USER_ID = process.env.CLUBKONNECT_USER_ID;
  const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY;
  const CLUBKONNECT_BASE_URL = process.env.CLUBKONNECT_BASE_URL || 'https://www.nellobytesystems.com';
  
  if (!CLUBKONNECT_USER_ID || !CLUBKONNECT_API_KEY) {
    console.error('❌ Clubkonnect credentials not configured');
    throw new Error('Clubkonnect API credentials not configured');
  }

  console.log('🚀 Calling Clubkonnect Data API...');
  console.log('Network Code:', networkCode);
  console.log('Phone:', phoneNumber);
  console.log('Plan Code:', planCode);
  console.log('Reference:', reference);

  try {
    const url = new URL(`${CLUBKONNECT_BASE_URL}/APIDatabundleV1.asp`);
    url.searchParams.append('UserID', CLUBKONNECT_USER_ID);
    url.searchParams.append('APIKey', CLUBKONNECT_API_KEY);
    url.searchParams.append('MobileNetwork', networkCode);
    url.searchParams.append('DataPlan', planCode);
    url.searchParams.append('MobileNumber', phoneNumber);
    url.searchParams.append('RequestID', reference);

    console.log('📡 Request URL:', url.toString().replace(CLUBKONNECT_API_KEY, '***'));

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    console.log('📡 Response status:', response.status);

    const responseText = await response.text();
    console.log('📡 Raw response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse response:', e);
      return {
        success: false,
        message: `Invalid response: ${responseText.substring(0, 100)}`,
        provider_response: { raw: responseText },
      };
    }

    console.log('📡 Parsed response:', JSON.stringify(data, null, 2));

    // Error handling
    if (data.status === 'INVALID_CREDENTIALS' || data.status === 'MISSING_CREDENTIALS') {
      return {
        success: false,
        message: 'Invalid API credentials. Contact support.',
        provider_response: data,
      };
    }

    if (data.status === 'INSUFFICIENT_BALANCE') {
      return {
        success: false,
        message: 'Service temporarily unavailable. Please try again later.',
        provider_response: data,
      };
    }

    if (data.status === 'INVALID_DATAPLAN') {
      return {
        success: false,
        message: 'Invalid data plan. Please select a different plan.',
        provider_response: data,
      };
    }

    if (data.status === 'INVALID_RECIPIENT') {
      return {
        success: false,
        message: 'Invalid phone number format.',
        provider_response: data,
      };
    }

    // Success indicators
    const isSuccess = 
      data.status === 'ORDER_RECEIVED' || 
      data.statuscode === '100' ||
      data.status === 'ORDER_COMPLETED' ||
      data.statuscode === '200';

    return {
      success: isSuccess,
      message: isSuccess ? 'Data purchase successful' : (data.status || 'Purchase failed'),
      provider_reference: data.orderid || reference,
      provider_response: data,
    };
  } catch (error: any) {
    console.error('❌ Clubkonnect error:', error);
    return {
      success: false,
      message: `Network error: ${error.message}`,
      provider_response: { error: error.message },
    };
  }
}

export async function POST(request: NextRequest) {
  console.log('\n🔔 New data purchase request');
  
  try {
    const body = await request.json();
    const { userId, phoneNumber, planCode, network, networkCode, amount, reference } = body;

    console.log('📥 Request:', { userId, phoneNumber, planCode, network, networkCode, amount, reference });

    // Validation
    if (!userId || !phoneNumber || !planCode || !amount || !reference || !networkCode) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length !== 11 || !cleanedPhone.startsWith('0')) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const commission = calculateCommission(amount);
    const totalCharge = amount + commission;

    console.log(`💰 Data: ₦${amount}, Fee: ₦${commission}, Total: ₦${totalCharge}`);

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      console.error('❌ Wallet error:', walletError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch wallet' },
        { status: 500 }
      );
    }

    console.log('💵 Current balance:', wallet.balance);

    // Check balance
    if (wallet.balance < totalCharge) {
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient balance. You need ₦${totalCharge.toLocaleString()} (₦${amount.toLocaleString()} + ₦${commission.toLocaleString()} fee)`
        },
        { status: 400 }
      );
    }

    // Create transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: totalCharge,
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

    // Purchase data
    let providerResult;
    try {
      providerResult = await purchaseDataWithClubkonnect(networkCode, phoneNumber, planCode, reference);
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
      console.log('💸 Deducting from wallet...');

      // Deduct from wallet
      const newBalance = wallet.balance - totalCharge;
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

      console.log('✅ Wallet deducted. New balance:', newBalance);

      // Update transaction
      await supabase
        .from('transactions')
        .update({
          status: 'success',
          provider_reference: providerResult.provider_reference,
        })
        .eq('id', transaction.id);

      console.log('🎉 Data purchase completed!');

      return NextResponse.json({
        success: true,
        message: providerResult.message,
        new_balance: newBalance,
        transaction_id: transaction.id,
        data_amount: amount,
        commission: commission,
        total_charged: totalCharge,
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
      { success: false, message: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}