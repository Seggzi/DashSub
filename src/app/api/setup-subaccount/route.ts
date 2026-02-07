import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('\n💼 Creating Clubkonnect subaccount');

  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

    // Create Clubkonnect subaccount on Paystack
    const response = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_name: 'Clubkonnect',
        settlement_bank: '044', // Access Bank (or their actual bank code)
        account_number: '6608407204', // Replace with their actual account
        percentage_charge: 85, // Clubkonnect gets 85%, you keep 15%
        description: 'Data provider subaccount',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Paystack error:', data);
      throw new Error(data.message);
    }

    console.log('✅ Subaccount created:', data.data.subaccount_code);

    return NextResponse.json({
      success: true,
      subaccount_code: data.data.subaccount_code,
      data: data.data,
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}