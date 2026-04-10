// app/api/create-virtual-account/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const isTestMode = (process.env.PAYVESSEL_API_KEY ?? '').startsWith('PVTESTKEY-');
const BASE = isTestMode
  ? 'https://sandbox.payvessel.com'
  : 'https://api.payvessel.com';

export async function POST(req: NextRequest) {
  try {
    const { userId, idType, idValue } = await req.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });
    }

    // ── Validate BVN/NIN ──────────────────────────────────────────────────
    if (!idType || !idValue) {
      return NextResponse.json(
        { success: false, message: 'BVN or NIN is required to create a virtual account.' },
        { status: 400 }
      );
    }

    if (!['bvn', 'nin'].includes(idType)) {
      return NextResponse.json({ success: false, message: 'Invalid ID type. Use bvn or nin.' }, { status: 400 });
    }

    if (!/^\d{11}$/.test(idValue)) {
      return NextResponse.json(
        { success: false, message: `${idType.toUpperCase()} must be exactly 11 digits.` },
        { status: 400 }
      );
    }

    // ── Check env vars ────────────────────────────────────────────────────
    if (!process.env.PAYVESSEL_API_KEY || !process.env.PAYVESSEL_SECRET_KEY || !process.env.PAYVESSEL_BUSINESS_ID) {
      console.error('Missing Payvessel env vars');
      return NextResponse.json(
        { success: false, message: 'Payment provider not configured. Contact support.' },
        { status: 500 }
      );
    }

    // ── Load user profile ─────────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, monnify_accounts, phone')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // ── Already has accounts? Return them ────────────────────────────────
    if (
      profile.monnify_accounts &&
      Array.isArray(profile.monnify_accounts) &&
      profile.monnify_accounts.length > 0
    ) {
      return NextResponse.json({
        success:  true,
        message:  'Virtual account already exists',
        accounts: profile.monnify_accounts,
      });
    }

    // ── Resolve email ─────────────────────────────────────────────────────
    let userEmail = profile.email;
    if (!userEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? `user_${userId.slice(0, 8)}@dashsub.ng`;
    }

    const fullName = profile.full_name?.trim() || userEmail.split('@')[0];

    // ── Build Payvessel request body ──────────────────────────────────────
    const payvesselBody: Record<string, any> = {
      email:        userEmail,
      name:         fullName,
      phoneNumber:  profile.phone || '08000000000',
      bankcode:     ['999991', '120001'],   // PalmPay + 9PSB
      account_type: 'STATIC',
      businessid:   process.env.PAYVESSEL_BUSINESS_ID,
    };

    // Add BVN or NIN based on user's choice
    if (idType === 'bvn') {
      payvesselBody.bvn = idValue;
    } else {
      payvesselBody.nin = idValue;
    }

    console.log('Creating Payvessel account for user:', userId, '| ID type:', idType);

    // ── Call Payvessel API ────────────────────────────────────────────────
    const payvesselRes = await fetch(
      `${BASE}/pms/api/external/request/customerReservedAccount/`,
      {
        method: 'POST',
        headers: {
          'api-key':      process.env.PAYVESSEL_API_KEY!,
          'api-secret':   `Bearer ${process.env.PAYVESSEL_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payvesselBody),
      }
    );

    const payvesselData = await payvesselRes.json();
    console.log('Payvessel response:', JSON.stringify(payvesselData, null, 2));

    // ── Check for success ─────────────────────────────────────────────────
    if (!payvesselRes.ok || !payvesselData.status) {
      const msg = payvesselData?.message ?? payvesselData?.error ?? 'Failed to create virtual account';
      console.error('Payvessel error:', msg);
      return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }

    // ── Normalise response ────────────────────────────────────────────────
    const rawBanks: any[] = payvesselData?.banks ?? [];

    if (!rawBanks.length) {
      return NextResponse.json(
        { success: false, message: 'No virtual accounts returned. Try again.' },
        { status: 500 }
      );
    }

    const accounts = rawBanks.map((b: any) => ({
      bankName:          b.bankName      ?? '',
      bankCode:          b.bankCode      ?? '',
      accountNumber:     b.accountNumber ?? '',
      accountName:       b.accountName   ?? fullName,
      trackingReference: b.trackingReference ?? '',
    }));

    const trackingReference = accounts[0].trackingReference;

    // ── Save to Supabase ──────────────────────────────────────────────────
    // Store accounts but NOT the raw BVN/NIN for security
    // Only store that verification was completed
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        monnify_accounts:          accounts,
        monnify_account_reference: trackingReference,
        // Store verification status (not the actual BVN/NIN value)
        [`${idType}_verified`]:    true,
      })
      .eq('id', userId);

    if (updateErr) {
      console.error('Supabase update error:', updateErr);
      // Accounts were created at Payvessel but not saved — still return success
      // so user can retry saving
      return NextResponse.json(
        { success: false, message: 'Account created but could not be saved. Contact support with ref: ' + trackingReference },
        { status: 500 }
      );
    }

    console.log(`✅ Virtual account created for user ${userId}`);
    return NextResponse.json({ success: true, accounts });

  } catch (err: any) {
    console.error('create-virtual-account error:', err);
    return NextResponse.json(
      { success: false, message: err.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}