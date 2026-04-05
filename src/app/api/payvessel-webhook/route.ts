import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Verify Payvessel HMAC-SHA256 signature ───────────────────────────
function verifySignature(rawBody: string, headerSig: string): boolean {
  const secret = process.env.PAYVESSEL_SECRET_KEY ?? '';
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return computed === headerSig;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody  = await req.text();
    const headerSig = req.headers.get('x-payvessel-signature') ?? '';

    // ── 1. Verify signature ────────────────────────────────────────
    if (process.env.PAYVESSEL_SECRET_KEY && !verifySignature(rawBody, headerSig)) {
      console.warn('❌ Invalid Payvessel webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Payvessel event types for virtual account credits:
    // "virtualaccount.credit" or "collection.credit"
    const eventType: string = payload?.event ?? payload?.eventType ?? '';
    const data              = payload?.data   ?? payload?.eventData ?? {};

    console.log('📩 Payvessel webhook event:', eventType);

    if (
      !eventType.toLowerCase().includes('credit') &&
      eventType !== 'SUCCESSFUL_TRANSACTION'
    ) {
      // Not a credit event — acknowledge and ignore
      return NextResponse.json({ received: true });
    }

    // ── 2. Extract key fields ────────────────────────────────────────
    const transactionReference: string =
      data.transactionReference ??
      data.reference            ??
      data.txRef                ?? '';

    const customerReference: string =
      data.customerReference  ??
      data.accountReference   ??
      data.customer_reference ?? '';

    const amountPaid: number =
      parseFloat(data.amount ?? data.amountPaid ?? data.settledAmount ?? '0');

    if (!transactionReference || !customerReference || amountPaid <= 0) {
      console.warn('Payvessel webhook missing required fields:', {
        transactionReference,
        customerReference,
        amountPaid,
      });
      return NextResponse.json({ received: true });
    }

    // ── 3. Idempotency — skip if already processed ──────────────────
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference', transactionReference)
      .maybeSingle();

    if (existing) {
      console.log('⚠️  Duplicate webhook — already processed:', transactionReference);
      return NextResponse.json({ received: true });
    }

    // ── 4. Find user by customerReference ───────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('monnify_account_reference', customerReference)   // stored in this column
      .maybeSingle();

    if (profileErr || !profile) {
      console.error('❌ No user found for customerReference:', customerReference);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = profile.id;

    // ── 5. Get current wallet ────────────────────────────────────────
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) {
      console.error('❌ Wallet not found for user:', userId);
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const newBalance = Number(wallet.balance) + amountPaid;

    // ── 6. Credit wallet ─────────────────────────────────────────────
    const { error: balErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (balErr) {
      console.error('❌ Failed to update wallet balance:', balErr);
      return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 });
    }

    // ── 7. Record transaction ────────────────────────────────────────
    await supabase.from('transactions').insert({
      user_id:   userId,
      amount:    amountPaid,
      reference: transactionReference,
      status:    'success',
      type:      'deposit',
      metadata:  {
        source:             'payvessel_transfer',
        customerReference,
        bankName:           data.bankName ?? data.bank_name ?? '',
        accountNumber:      data.accountNumber ?? data.account_number ?? '',
        senderName:         data.senderName ?? data.sender_name ?? '',
        raw:                data,
      },
    });

    console.log(`✅ Credited ₦${amountPaid} to user ${userId}`);
    return NextResponse.json({ received: true, credited: amountPaid });

  } catch (err: any) {
    console.error('Payvessel webhook unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}