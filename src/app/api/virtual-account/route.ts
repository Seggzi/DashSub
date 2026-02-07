// app/api/virtual-account/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMonnifyToken } from '@/lib/monnify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, email, fullName } = await request.json();

    if (!userId || !email || !fullName) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: userId, email, fullName' },
        { status: 400 }
      );
    }

    console.log('Creating virtual account for user:', userId);

    // Get fresh token
    const token = await getMonnifyToken();

    const accountReference = `DS_${userId}_${Date.now()}`;

    const response = await fetch('https://api.monnify.com/api/v2/bank-transfer/reserved-accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountReference,
        accountName: fullName || 'DashSub User',
        currencyCode: 'NGN',
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        customerEmail: email,
        customerName: fullName || 'DashSub User',
        // bvn: '', // add later if you collect BVN
        getAllAvailableBanks: false,
        preferredBanks: ['50515'], // Moniepoint – most reliable
      }),
    });

    const data = await response.json();

    if (!data.requestSuccessful) {
      console.error('Monnify error:', data.responseMessage);
      return NextResponse.json(
        { success: false, message: data.responseMessage || 'Failed to create account' },
        { status: 400 }
      );
    }

    const account = data.responseBody.accounts?.[0];

    if (!account) {
      return NextResponse.json(
        { success: false, message: 'No account returned from Monnify' },
        { status: 500 }
      );
    }

    // Save to Supabase
    const { error } = await supabase.from('virtual_accounts').upsert({
      user_id: userId,
      account_number: account.accountNumber,
      bank_name: account.bankName,
      bank_code: account.bankCode,
      account_reference: data.responseBody.accountReference,
      reservation_reference: data.responseBody.reservationReference,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

    if (error) {
      console.error('Supabase save error:', error);
      return NextResponse.json({ success: false, message: 'Failed to save account' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      account: {
        number: account.accountNumber,
        bank: account.bankName,
        name: account.accountName,
        reference: data.responseBody.accountReference,
      },
    });
  } catch (err: any) {
    console.error('Virtual account creation failed:', err.message);
    return NextResponse.json(
      { success: false, message: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
