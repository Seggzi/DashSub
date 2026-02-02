// src/app/api/paystack-webhook/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Must be service_role key
);

export async function POST(req: Request) {
  try {
    const body = await req.text(); // Raw body for signature
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      console.error('Missing signature');
      return new NextResponse('Missing signature', { status: 400 });
    }

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid signature');
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);

    console.log('Webhook event received:', event.event);

    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data;
      const userId = metadata.user_id;
      const amountInNaira = amount / 100;

      if (!userId) {
        console.error('No user_id in metadata');
        return new NextResponse('No user_id', { status: 400 });
      }

      console.log(`Successful payment for user ${userId}: ₦${amountInNaira}`);

      // Update transaction to success
      const { error: txError } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'success' })
        .eq('reference', reference)
        .eq('user_id', userId);

      if (txError) {
        console.error('Transaction update failed:', txError);
        return new NextResponse('TX update failed', { status: 500 });
      }

      // Add to wallet balance
      const { error: walletError } = await supabaseAdmin.rpc('add_to_wallet', {
        target_user_id: userId,
        amount_to_add: amountInNaira,
      });

      if (walletError) {
        console.error('Wallet update failed:', walletError);
        return new NextResponse('Wallet update failed', { status: 500 });
      }

      console.log(`Balance updated for user ${userId}: +₦${amountInNaira}`);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new NextResponse('Error', { status: 500 });
  }
}

// Required for raw body + Vercel compatibility
export const config = {
  api: {
    bodyParser: false,
  },
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';