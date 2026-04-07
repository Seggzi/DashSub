import { NextRequest, NextResponse } from 'next/server';

// Gladtidings DISCO ID map
const DISCO_IDS: Record<string, number> = {
  'ikeja-electric':       18,
  'ibadan-electric':      19,
  'eko-electric':         20,
  'portharcourt-electric':21,
  'kaduna-electric':      22,
  'kano-electric':        23,
  'jos-electric':         24,
  'abuja-electric':       25,
  'enugu-electric':       26,
  'yola-electric':        28,
  'benin-electric':       29,
};

export async function POST(req: NextRequest) {
  try {
    const { meterNumber, discoCode, meterType } = await req.json();

    if (!meterNumber || !discoCode || !meterType) {
      return NextResponse.json(
        { success: false, message: 'meterNumber, discoCode and meterType are required' },
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

    const params = new URLSearchParams({
      disco_id:     discoId.toString(),
      meter_type:   meterType,   // "prepaid" or "postpaid"
      meter_number: meterNumber,
    });

    const res = await fetch(
      `https://www.gladtidingsdata.com/api/v2/validatemeter/?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.GLADTIDINGS_TOKEN}`,
          'Content-Type':  'application/json',
        },
      }
    );

    const data = await res.json();
    console.log('Gladtidings validate response:', JSON.stringify(data, null, 2));

    // Response: { invalid: false, name: "ADAMS BROWN", address: "..." }
    if (data?.invalid === false && data?.name) {
      return NextResponse.json({
        success:      true,
        customerName: data.name,
        address:      data.address ?? '',
      });
    }

    // invalid: true means meter not found
    return NextResponse.json({
      success: false,
      message: data?.message ?? 'Meter number not found. Check and try again.',
    });

  } catch (err: any) {
    console.error('verify-meter error:', err);
    return NextResponse.json(
      { success: false, message: 'Could not verify meter. Try again.' },
      { status: 500 }
    );
  }
}