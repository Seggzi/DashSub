import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

function verifyMonnifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', process.env.MONNIFY_SECRET_KEY!)
    .update(body)
    .digest('hex');
  
  return hash === signature;
}

export async function POST(request: NextRequest) {
  console.log('\n🔔 Monnify webhook received');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await request.text();
    const signature = request.headers.get('monnify-signature');

    console.log('📦 Body length:', body.length);
    console.log('🔐 Signature present:', !!signature);

    if (!signature) {
      console.error('❌ No signature in request');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    if (!verifyMonnifySignature(body, signature)) {
      console.error('❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('✅ Signature verified');

    const event = JSON.parse(body);
    console.log('📨 Event data:', JSON.stringify(event, null, 2));

    // Monnify sends transaction data in eventData
    const data = event.eventData;

    if (!data) {
      console.error('❌ No event data in webhook');
      return NextResponse.json({ error: 'No event data' }, { status: 400 });
    }

    console.log('💰 Transaction details:', {
      amount: data.amountPaid,
      reference: data.transactionReference,
      accountReference: data.accountReference,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
    });

    // Only process successful payments
    if (data.paymentStatus !== 'PAID') {
      console.log(`⚠️ Payment status is ${data.paymentStatus}, skipping`);
      return NextResponse.json({ message: 'Payment not completed' });
    }

    // Get amount in Naira
    const amount = parseFloat(data.amountPaid);

    // Find user by account reference (DashSub account number)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, wallets(*)')
      .eq('account_number', data.accountReference)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile not found for account reference:', data.accountReference);
      console.error('Error:', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    console.log('👤 Found user:', profile.id, profile.full_name);

    // Check if transaction already processed (prevent duplicate credits)
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference', data.transactionReference)
      .single();

    if (existingTx) {
      console.log('⚠️ Transaction already processed:', data.transactionReference);
      return NextResponse.json({ message: 'Already processed' });
    }

    // Get current wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', profile.id)
      .single();

    const currentBalance = wallet?.balance || 0;
    const newBalance = currentBalance + amount;

    console.log('💳 Wallet update:', {
      currentBalance,
      depositAmount: amount,
      newBalance,
    });

    // Update wallet balance
    const { error: walletError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', profile.id);

    if (walletError) {
      console.error('❌ Failed to update wallet:', walletError);
      throw walletError;
    }

    console.log('✅ Wallet updated successfully');

    // Create transaction record
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: profile.id,
        amount: amount,
        type: 'deposit',
        status: 'success',
        reference: data.transactionReference,
        payment_method: 'bank_transfer',
        provider_reference: data.paymentReference,
        metadata: {
          bank: data.accountDetails?.bankName || 'Unknown',
          accountNumber: data.accountDetails?.accountNumber,
          customerName: data.customer?.name,
          settledAmount: data.settledAmount,
        }
      });

    if (txError) {
      console.error('❌ Failed to create transaction:', txError);
      throw txError;
    }

    console.log('✅ Transaction record created');

    console.log('🎉 Wallet credited successfully:', {
      userId: profile.id,
      amount: amount,
      newBalance: newBalance,
      transactionRef: data.transactionReference,
    });

    return NextResponse.json({ 
      success: true,
      message: 'Wallet credited successfully',
    });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { error: error.message, details: error.toString() },
      { status: 500 }
    );
  }
}