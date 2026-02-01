import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use the SECRET key from Supabase settings
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signature = req.headers.get('x-paystack-signature');
    
    // Verify the message is really from Paystack
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(JSON.stringify(body))
      .digest('hex');

    if (hash !== signature) return new NextResponse('Unauthorized', { status: 401 });

    if (body.event === 'charge.success') {
      const { reference, amount, metadata } = body.data;
      const userId = metadata.user_id;
      const amountInNaira = amount / 100;

      // 1. Mark transaction as success
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'success' })
        .eq('reference', reference);

      // 2. Call the SQL function we just created to update the balance
      await supabaseAdmin.rpc('add_to_wallet', { 
        target_user_id: userId, 
        amount_to_add: amountInNaira 
      });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    return new NextResponse('Error', { status: 500 });
  }
}