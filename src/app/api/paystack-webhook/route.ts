// src/app/api/paystack-webhook/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Critical: service_role key (dangerous — keep secret!)
);

export async function POST(req: Request) {
  try {
    const body = await req.text(); // Paystack sends raw JSON
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return new NextResponse('Missing signature', { status: 400 });
    }

    // Verify signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);

    // Only handle successful charges
    if (event.event === 'charge.success') {
      const { reference, amount, status, metadata } = event.data;
      const userId = metadata.user_id;
      const amountInNaira = amount / 100; // Paystack sends in kobo

      if (!userId) {
        console.error('No user_id in metadata');
        return new NextResponse('No user_id', { status: 400 });
      }

      // 1. Update transaction status to success
      const { error: txError } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'success' })
        .eq('reference', reference)
        .eq('user_id', userId);

      if (txError) {
        console.error('Transaction update error:', txError);
        return new NextResponse('Transaction update failed', { status: 500 });
      }

      // 2. Add amount to wallet balance (safe with service_role)
      const { error: walletError } = await supabaseAdmin
        .rpc('add_to_wallet', {
          target_user_id: userId,
          amount_to_add: amountInNaira,
        });

      if (walletError) {
        console.error('Wallet update error:', walletError);
        // Optional: mark transaction as failed if wallet update fails
        return new NextResponse('Wallet update failed', { status: 500 });
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false, // Important: disable bodyParser for raw body
  },
};