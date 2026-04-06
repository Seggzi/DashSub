// app/api/verify-meter/route.ts
//
// Verifies a meter number before payment — returns customer name.
// Call this when user finishes typing their meter number.
//
// Required env vars:
//   VTPASS_API_KEY      — from VTPass dashboard → Settings → API
//   VTPASS_SECRET_KEY   — from VTPass dashboard → Settings → API
//   VTPASS_BASE_URL     — https://sandbox.vtpass.com (test) or https://api-service.vtpass.com (live)

import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.VTPASS_BASE_URL ?? 'https://sandbox.vtpass.com';

export async function POST(req: NextRequest) {
  try {
    const { meterNumber, discoCode, meterType } = await req.json();

    if (!meterNumber || !discoCode || !meterType) {
      return NextResponse.json(
        { success: false, message: 'meterNumber, discoCode and meterType are required' },
        { status: 400 }
      );
    }

    const credentials = Buffer.from(
      `${process.env.VTPASS_API_KEY}:${process.env.VTPASS_SECRET_KEY}`
    ).toString('base64');

    const res = await fetch(`${BASE}/api/merchant-verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        billersCode: meterNumber,
        serviceID:   discoCode,   // e.g. "ikeja-electric"
        type:        meterType,   // "prepaid" or "postpaid"
      }),
    });

    const data = await res.json();
    console.log('VTPass verify response:', JSON.stringify(data, null, 2));

    if (data?.code === '000' || data?.content?.Customer_Name) {
      return NextResponse.json({
        success:      true,
        customerName: data?.content?.Customer_Name ?? data?.content?.name ?? 'Customer',
        address:      data?.content?.Address ?? '',
      });
    }

    return NextResponse.json({
      success: false,
      message: data?.content?.error ?? data?.response_description ?? 'Could not verify meter',
    });

  } catch (err: any) {
    console.error('verify-meter error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}