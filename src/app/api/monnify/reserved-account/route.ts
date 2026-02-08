import { NextRequest, NextResponse } from 'next/server';
// import { getMonnifyToken } from '@/lib/monnify';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { userId, email, fullName } = await req.json();

    if (!userId || !email || !fullName) {
      return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    }

    const token = await getMonnifyToken();

    const reference = `DS_USER_${userId}_${Date.now()}`;

    const res = await fetch('https://api.monnify.com/api/v2/bank-transfer/reserved-accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountReference: reference,
        accountName: fullName,
        currencyCode: 'NGN',
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        customerEmail: email,
        customerName: fullName,
        bvn: '', // optional — collect later if needed
        getAllAvailableBanks: true,
        preferredBanks: ['50515'], // Moniepoint — most reliable
        // incomeSplitConfig: [] // add later if splitting with Peyflex
      }),
    });

    const data = await res.json();

    if (!data.requestSuccessful) {
      return NextResponse.json({ success: false, message: data.responseMessage }, { status: 400 });
    }

    const account = data.responseBody.accounts[0]; // first account

    // Save to Supabase
    await supabase.from('virtual_accounts').upsert({
      user_id: userId,
      account_number: account.accountNumber,
      bank_name: account.bankName,
      bank_code: account.bankCode,
      account_reference: data.responseBody.accountReference,
      reservation_reference: data.responseBody.reservationReference,
    });

    return NextResponse.json({
      success: true,
      account: {
        number: account.accountNumber,
        bank: account.bankName,
        name: account.accountName,
      },
    });
  } catch (err: any) {
    console.error('Monnify reserved account error:', err);
    return NextResponse.json({ success: false, message: 'Failed to create account' }, { status: 500 });
  }
}

function getMonnifyToken() {
  throw new Error('Function not implemented.');
}
