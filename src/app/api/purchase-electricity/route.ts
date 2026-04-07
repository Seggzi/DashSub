import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Gladtidings DISCO ID map — same as verify-meter
const DISCO_IDS: Record<string, number> = {
  'ikeja-electric':        18,
  'ibadan-electric':       19,
  'eko-electric':          20,
  'portharcourt-electric': 21,
  'kaduna-electric':       22,
  'kano-electric':         23,
  'jos-electric':          24,
  'abuja-electric':        25,
  'enugu-electric':        26,
  'yola-electric':         28,
  'benin-electric':        29,
};

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      meterNumber,
      discoCode,
      meterType,
      amount,
      phone,
      customerName,
      customerAddress,
      reference,
    } = await req.json();

    // ── 1. Validate inputs ───────────────────────────────────────────
    if (!userId || !meterNumber || !discoCode || !meterType || !amount || !phone || !reference) {
      return NextResponse.json(
        { success: false, message: 'All fields are required' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 500) {
      return NextResponse.json(
        { success: false, message: 'Minimum amount is ₦500' },
        { status: 400 }
      );
    }

    const discoId = DISCO_IDS[discoCode];
    if (!discoId) {
      return NextResponse.json(
        { success: false, message: 'Invalid DISCO selected' },
        { status: 400 }
      );
    }

    // ── 2. Check wallet balance ──────────────────────────────────────
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) {
      return NextResponse.json(
        { success: false, message: 'Wallet not found' },
        { status: 404 }
      );
    }

    if (Number(wallet.balance) < numAmount) {
      return NextResponse.json(
        { success: false, message: `Insufficient balance. You need ₦${numAmount.toLocaleString()}` },
        { status: 400 }
      );
    }

    // ── 3. Create pending transaction ────────────────────────────────
    await supabase.from('transactions').insert({
      user_id:      userId,
      amount:       numAmount,
      reference,
      status:       'pending',
      type:         'electricity',
      phone_number: phone,
      metadata:     { discoCode, discoId, meterType, meterNumber, customerName, customerAddress },
    });

    // ── 4. Call Gladtidings bill payment API ─────────────────────────
    // POST https://www.gladtidingsdata.com/api/v2/billpayment/
    // Body: disco_id, amount, meter_number, meter_type, Customer_Phone,
    //       customer_name, customer_address
    const gladRes = await fetch(
      'https://www.gladtidingsdata.com/api/v2/billpayment/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GLADTIDINGS_TOKEN}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          disco_id:         discoId,
          amount:           numAmount,
          meter_number:     meterNumber,
          meter_type:       meterType,          // "prepaid" or "postpaid"
          Customer_Phone:   phone,
          customer_name:    customerName  || '',
          customer_address: customerAddress || '',
        }),
      }
    );

    const gladData = await gladRes.json();
    console.log('Gladtidings billpayment response:', JSON.stringify(gladData, null, 2));

    // ── 5. Check response ────────────────────────────────────────────
    // Success: { Status: "successful", token: "Token : 03039...", ... }
    const isSuccess =
      gladData?.Status?.toLowerCase() === 'successful' ||
      gladData?.status?.toLowerCase()  === 'successful';

    if (!isSuccess) {
      // Mark transaction failed
      await supabase.from('transactions')
        .update({ status: 'failed' })
        .eq('reference', reference);

      const errMsg =
        gladData?.message ??
        gladData?.detail  ??
        gladData?.Status  ??
        'Purchase failed. Please try again.';

      return NextResponse.json({ success: false, message: errMsg });
    }

    // ── 6. Deduct wallet balance ─────────────────────────────────────
    const newBalance = Number(wallet.balance) - numAmount;
    await supabase.from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    // ── 7. Update transaction to success ────────────────────────────
    // Extract token — Gladtidings returns: "Token : 03039561630634665485"
    const rawToken: string = gladData?.token ?? '';
    const token = rawToken.replace(/^Token\s*:\s*/i, '').trim();

    await supabase.from('transactions')
      .update({
        status:   'success',
        metadata: {
          discoCode,
          discoId,
          meterType,
          meterNumber,
          customerName,
          customerAddress,
          token,
          paidAmount:    gladData?.paid_amount,
          balanceBefore: gladData?.balance_before,
          balanceAfter:  gladData?.balance_after,
          gladtidingsId: gladData?.id,
          ident:         gladData?.ident,
        },
      })
      .eq('reference', reference);

    return NextResponse.json({
      success: true,
      token,
      message: 'Electricity purchased successfully!',
    });

  } catch (err: any) {
    console.error('purchase-electricity error:', err);
    return NextResponse.json(
      { success: false, message: err.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}