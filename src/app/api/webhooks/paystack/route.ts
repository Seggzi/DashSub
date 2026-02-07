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

function verifyPaystackSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest('hex');
  
  return hash === signature;
}

export async function POST(request: NextRequest) {
  console.log('\n🔔 Paystack webhook received');

  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      console.error('❌ No signature in request');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    if (!verifyPaystackSignature(body, signature)) {
      console.error('❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log('📨 Event type:', event.event);

    // Handle successful charge (bank transfer to virtual account)
    if (event.event === 'charge.success') {
      const data = event.data;

      console.log('💰 Charge successful:', {
        amount: data.amount / 100,
        reference: data.reference,
        customer: data.customer.email,
      });

      // Get amount in Naira
      const amount = data.amount / 100; // Paystack sends in kobo

      // Find user by virtual account number or email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, wallets(*)')
        .or(`virtual_account_number.eq.${data.authorization?.receiver_bank_account_number},email.eq.${data.customer.email}`)
        .single();

      if (profileError || !profile) {
        console.error('❌ Profile not found');
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      console.log('👤 Found user:', profile.id);

      // Check if transaction already processed (prevent duplicate)
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference', data.reference)
        .single();

      if (existingTx) {
        console.log('⚠️ Transaction already processed');
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

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', profile.id);

      if (walletError) {
        console.error('❌ Failed to update wallet:', walletError);
        throw walletError;
      }

      // Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: profile.id,
          amount: amount,
          type: 'deposit',
          status: 'success',
          reference: data.reference,
          payment_method: 'bank_transfer',
          provider_reference: data.id,
        });

      if (txError) {
        console.error('❌ Failed to create transaction:', txError);
        throw txError;
      }

      console.log('✅ Wallet credited:', {
        userId: profile.id,
        amount: amount,
        newBalance: newBalance,
      });

      return NextResponse.json({ 
        success: true,
        message: 'Wallet credited successfully',
      });
    }

    // Handle dedicated account assignment
    if (event.event === 'dedicatedaccount.assign.success') {
      console.log('🏦 Dedicated account assigned:', event.data);
    }

    return NextResponse.json({ message: 'Webhook received' });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}