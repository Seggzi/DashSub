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

const PROVIDER = process.env.AIRTIME_PROVIDER || 'peyflex';
const COMMISSION_RATE = 0.02;

function calculateCommission(amount: number): number {
  return Math.ceil(amount * COMMISSION_RATE);
}

async function purchaseAirtimeWithPeyflex(
  network: string,
  phoneNumber: string,
  amount: number
) {
  const PEYFLEX_API_KEY = process.env.PEYFLEX_API_KEY;
  
  if (!PEYFLEX_API_KEY) {
    console.error('❌ PEYFLEX_API_KEY not found in environment');
    throw new Error('Peyflex API key not configured');
  }

  console.log('🚀 Calling Peyflex Airtime API...');
  console.log('Network:', network);
  console.log('Phone:', phoneNumber);
  console.log('Amount:', amount);
  console.log('API Key (first 10 chars):', PEYFLEX_API_KEY.substring(0, 10) + '...');

  const payload = {
    network: network,
    amount: amount,
    mobile_number: phoneNumber,
  };
  
  console.log('📦 Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://client.peyflex.com.ng/api/airtime/topup/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${PEYFLEX_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    const responseText = await response.text();
    console.log('📡 Raw response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse response as JSON:', e);
      return {
        success: false,
        message: `Invalid response from Peyflex: ${responseText.substring(0, 100)}`,
        provider_response: { raw: responseText },
      };
    }

    console.log('📡 Parsed response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Peyflex HTTP error:', response.status, response.statusText);
      return {
        success: false,
        message: data.message || data.error || `Peyflex error: ${response.status}`,
        provider_response: data,
      };
    }

    // Check for success in various formats
    const isSuccess = data.status === 'success' || 
                     data.success === true || 
                     data.Status === 'successful' ||
                     response.status === 200 || 
                     response.status === 201;

    return {
      success: isSuccess,
      message: data.message || data.msg || 'Airtime purchase completed',
      provider_reference: data.reference || data.transaction_id || data.id || data.ident,
      provider_response: data,
    };
  } catch (error: any) {
    console.error('❌ Peyflex fetch error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
      stack: error.stack?.substring(0, 200),
    });
    
    return {
      success: false,
      message: `Network error: ${error.message}. Please check your internet connection or try again.`,
      provider_response: { error: error.message },
    };
  }
}

export async function POST(request: NextRequest) {
  console.log('\n🔔 New airtime purchase request');
  
  try {
    const body = await request.json();
    const { userId, phoneNumber, amount, network, reference } = body;

    console.log('📥 Request data:', { userId, phoneNumber, amount, network, reference });

    if (!userId || !phoneNumber || !amount || !network || !reference) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const commission = calculateCommission(amount);
    const totalCharge = amount + commission;

    console.log(`💰 Breakdown - Airtime: ₦${amount}, Commission: ₦${commission}, Total: ₦${totalCharge}`);

    // Get user's wallet balance
    console.log('🔍 Fetching wallet for user:', userId);
    
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      console.error('❌ Wallet fetch error:', walletError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch wallet: ' + walletError.message },
        { status: 500 }
      );
    }

    if (!wallet) {
      console.error('❌ Wallet not found');
      return NextResponse.json(
        { success: false, message: 'Wallet not found' },
        { status: 404 }
      );
    }

    console.log('💳 Wallet balance:', wallet.balance);

    if (wallet.balance < totalCharge) {
      console.error(`❌ Insufficient balance: ${wallet.balance} < ${totalCharge}`);
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient balance. You need ₦${totalCharge} (₦${amount} + ₦${commission} fee)`
        },
        { status: 400 }
      );
    }

    // Create pending transaction
    console.log('📝 Creating transaction...');
    
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: totalCharge,
        type: 'airtime',
        status: 'pending',
        reference: reference,
        phone_number: phoneNumber,
        network: network,
      })
      .select()
      .single();

    if (txError) {
      console.error('❌ Transaction creation error:', txError);
      return NextResponse.json(
        { success: false, message: 'Failed to create transaction: ' + txError.message },
        { status: 500 }
      );
    }

    console.log('✅ Transaction created with ID:', transaction.id);

    // Purchase airtime from Peyflex
    console.log(`🚀 Calling ${PROVIDER} API...`);
    
    let providerResult;
    try {
      providerResult = await purchaseAirtimeWithPeyflex(network, phoneNumber, amount);
    } catch (error: any) {
      console.error('❌ Provider API error:', error);
      
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
      console.log('✅ Airtime purchase successful, updating wallet...');
      
      // Deduct from wallet
      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - totalCharge })
        .eq('user_id', userId);

      if (deductError) {
        console.error('❌ Wallet deduction error:', deductError);
        
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);

        return NextResponse.json(
          { success: false, message: 'Failed to deduct from wallet: ' + deductError.message },
          { status: 500 }
        );
      }

      // Update transaction to success
      await supabase
        .from('transactions')
        .update({
          status: 'success',
          provider_reference: providerResult.provider_reference,
        })
        .eq('id', transaction.id);

      console.log('✅ Purchase completed successfully!');

      return NextResponse.json({
        success: true,
        message: providerResult.message,
        new_balance: wallet.balance - totalCharge,
        transaction_id: transaction.id,
        airtime_amount: amount,
        commission: commission,
        total_charged: totalCharge,
      });
    } else {
      console.error('❌ Airtime purchase failed:', providerResult.message);
      
      // Update transaction to failed
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
    console.error('❌ Unexpected API error:', error);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { success: false, message: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}