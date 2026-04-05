
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Verify Payvessel webhook signature ──────────────────────────────
function verifySignature(rawBody: string, headerHash: string): boolean {
  // Payvessel uses sha512 HMAC of the raw body with your secret key
  const secret   = process.env.PAYVESSEL_SECRET_KEY ?? '';
  const computed = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  return computed === headerHash;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody   = await req.text();
    // Payvessel sends signature in "hash" header
    const headerHash = req.headers.get('hash') ?? req.headers.get('x-payvessel-hash') ?? '';

    // ── 1. Verify signature ──────────────────────────────────────────
    if (process.env.PAYVESSEL_SECRET_KEY) {
      if (headerHash && !verifySignature(rawBody, headerHash)) {
        console.warn('❌ Invalid Payvessel webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload   = JSON.parse(rawBody);
    const eventType: string = (payload?.event ?? payload?.type ?? '').toString().toUpperCase();
    const data      = payload?.data ?? payload?.eventData ?? payload ?? {};

    console.log('📩 Payvessel webhook:', eventType, JSON.stringify(data, null, 2));

    // ── 2. Only process successful collection/credit events ──────────
    const isCreditEvent =
      eventType.includes('CREDIT')         ||
      eventType.includes('COLLECTION')     ||
      eventType.includes('TRANSFER')       ||
      eventType === 'SUCCESSFUL_TRANSACTION';

    if (!isCreditEvent) {
      return NextResponse.json({ received: true });
    }

    // ── 3. Extract fields ────────────────────────────────────────────
    // Payvessel webhook payload for reserved account credit:
    const transactionReference: string =
      data.transactionReference ??
      data.reference            ??
      data.txRef                ??
      data.trackingReference    ?? '';

    // trackingReference links the account to our user
    const trackingReference: string =
      data.trackingReference    ??
      data.accountReference     ??
      data.customerReference    ??
      data.product?.reference   ?? '';

    const amountPaid: number = parseFloat(
      data.amount       ??
      data.amountPaid   ??
      data.settledAmount ?? '0'
    );

    if (!transactionReference || amountPaid <= 0) {
      console.warn('Webhook missing fields:', { transactionReference, amountPaid });
      return NextResponse.json({ received: true });
    }

    // ── 4. Idempotency check ─────────────────────────────────────────
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference', transactionReference)
      .maybeSingle();

    if (existing) {
      console.log('⚠️ Duplicate webhook — already processed:', transactionReference);
      return NextResponse.json({ received: true });
    }

    // ── 5. Find user by trackingReference ───────────────────────────
    let userId: string | null = null;

    if (trackingReference) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('monnify_account_reference', trackingReference)
        .maybeSingle();

      userId = profile?.id ?? null;
    }

    // Fallback: try matching by account number
    if (!userId && data.accountNumber) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, monnify_accounts')
        .not('monnify_accounts', 'is', null);

      if (profiles) {
        for (const p of profiles) {
          const accounts = p.monnify_accounts as any[];
          if (accounts?.some((a: any) => a.accountNumber === data.accountNumber)) {
            userId = p.id;
            break;
          }
        }
      }
    }

    if (!userId) {
      console.error('❌ Could not find user for webhook:', { trackingReference, accountNumber: data.accountNumber });
      // Return 200 so Payvessel doesn't keep retrying for unknown accounts
      return NextResponse.json({ received: true });
    }

    // ── 6. Get current wallet balance ────────────────────────────────
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) {
      console.error('❌ Wallet not found for user:', userId);
      return NextResponse.json({ error: 'Wallet not found' }, { status: 500 });
    }

    const newBalance = Number(wallet.balance) + amountPaid;

    // ── 7. Credit wallet ─────────────────────────────────────────────
    const { error: balErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (balErr) {
      console.error('❌ Failed to update wallet:', balErr);
      return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 });
    }

    // ── 8. Record transaction ────────────────────────────────────────
    await supabase.from('transactions').insert({
      user_id:   userId,
      amount:    amountPaid,
      reference: transactionReference,
      status:    'success',
      type:      'deposit',
      metadata:  {
        source:             'payvessel_transfer',
        trackingReference,
        bankName:           data.bankName ?? '',
        accountNumber:      data.accountNumber ?? '',
        senderName:         data.senderName ?? data.sender_name ?? '',
        raw:                data,
      },
    });

    console.log(`✅ Credited ₦${amountPaid} to user ${userId}`);
    return NextResponse.json({ received: true, credited: amountPaid });

  } catch (err: any) {
    console.error('Webhook unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}