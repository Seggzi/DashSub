// app/api/purchase-electricity/route.ts
//
// Purchases electricity token/payment via VTPass.
// Supports all Nigerian DISCOs, both prepaid and postpaid.
//
// Required env vars:
//   VTPASS_API_KEY
//   VTPASS_SECRET_KEY
//   VTPASS_BASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = process.env.VTPASS_BASE_URL ?? 'https://sandbox.vtpass.com';

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      meterNumber,
      discoCode,
      meterType,
      amount,
      phone,
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
    const { error: txInsertErr } = await supabase.from('transactions').insert({
      user_id:      userId,
      amount:       numAmount,
      reference,
      status:       'pending',
      type:         'electricity',
      phone_number: phone,
      metadata:     { discoCode, meterType, meterNumber },
    });

    if (txInsertErr) {
      return NextResponse.json(
        { success: false, message: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // ── 4. Call VTPass ───────────────────────────────────────────────
    const credentials = Buffer.from(
      `${process.env.VTPASS_API_KEY}:${process.env.VTPASS_SECRET_KEY}`
    ).toString('base64');

    const vtpassRes = await fetch(`${BASE}/api/pay`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        request_id:  reference,
        serviceID:   discoCode,
        billersCode: meterNumber,
        variation_code: meterType,   // "prepaid" or "postpaid"
        amount:      numAmount,
        phone,
      }),
    });

    const vtData = await vtpassRes.json();
    console.log('VTPass electricity response:', JSON.stringify(vtData, null, 2));

    const isSuccess =
      vtData?.code === '000' ||
      vtData?.content?.transactions?.status === 'delivered';

    if (!isSuccess) {
      // Mark transaction as failed
      await supabase.from('transactions')
        .update({ status: 'failed' })
        .eq('reference', reference);

      const errMsg = vtData?.response_description ?? vtData?.content?.transactions?.remarks ?? 'Purchase failed';
      return NextResponse.json({ success: false, message: errMsg });
    }

    // ── 5. Deduct wallet balance ─────────────────────────────────────
    const newBalance = Number(wallet.balance) - numAmount;
    await supabase.from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    // ── 6. Mark transaction success ──────────────────────────────────
    const token = vtData?.content?.transactions?.product_name ?? vtData?.content?.Token ?? '';

    await supabase.from('transactions')
      .update({
        status:   'success',
        metadata: {
          discoCode,
          meterType,
          meterNumber,
          token,
          units: vtData?.content?.transactions?.unit ?? '',
          rawResponse: vtData,
        },
      })
      .eq('reference', reference);

    return NextResponse.json({
      success: true,
      token,
      units:    vtData?.content?.transactions?.unit ?? '',
      message:  `Electricity purchase successful!`,
    });

  } catch (err: any) {
    console.error('purchase-electricity error:', err);
    return NextResponse.json(
      { success: false, message: err.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}