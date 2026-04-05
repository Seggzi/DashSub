// app/api/create-virtual-account/route.ts
//
// Creates a Payvessel STATIC reserved account for a user.
// Uses the CORRECT Payvessel API format based on official docs:
//   POST https://api.payvessel.com/pms/api/external/request/customerReservedAccount/
//
// Required env vars in .env.local AND Vercel:
//   PAYVESSEL_API_KEY        → starts with PVKEY-...
//   PAYVESSEL_SECRET_KEY     → starts with PVSECRET-...
//   PAYVESSEL_BUSINESS_ID    → from Payvessel dashboard → Settings → Business Info
//   SUPABASE_SERVICE_ROLE_KEY

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Auto-detect test vs live from key prefix
// PVTESTKEY- = test mode → sandbox base URL
// PVKEY-     = live mode → production base URL
const isTestMode = (process.env.PAYVESSEL_API_KEY ?? '').startsWith('PVTESTKEY-');
const BASE = isTestMode
  ? 'https://sandbox.payvessel.com'   // test/sandbox base
  : 'https://api.payvessel.com';      // production base

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'userId is required' },
        { status: 400 }
      );
    }

    // ── 1. Check env vars are set ────────────────────────────────────
    if (!process.env.PAYVESSEL_API_KEY || !process.env.PAYVESSEL_SECRET_KEY || !process.env.PAYVESSEL_BUSINESS_ID) {
      console.error('Missing Payvessel env vars');
      return NextResponse.json(
        { success: false, message: 'Payment provider not configured. Contact support.' },
        { status: 500 }
      );
    }

    // ── 2. Load user profile ─────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, monnify_accounts')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // ── 3. Already has accounts? Return them — idempotent ───────────
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

    // ── 4. Resolve user email ────────────────────────────────────────
    let userEmail = profile.email;
    if (!userEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? `user_${userId.slice(0, 8)}@dashsub.ng`;
    }

    const fullName = profile.full_name?.trim() || userEmail.split('@')[0];

    // ── 5. Call Payvessel reserved account API ───────────────────────
    //    Headers: api-key and api-secret (with Bearer prefix)
    //    Body: email, name, phoneNumber, bankcode[], account_type, businessid
    const payvesselRes = await fetch(
      `${BASE}/pms/api/external/request/customerReservedAccount/`,
      {
        method: 'POST',
        headers: {
          'api-key':       process.env.PAYVESSEL_API_KEY!,
          'api-secret':    `Bearer ${process.env.PAYVESSEL_SECRET_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          email:        userEmail,
          name:         fullName,
          phoneNumber:  '08000000000',   // placeholder — update if you collect phone
          // 999991 = PalmPay, 120001 = 9PSB (9Payment Service Bank)
          bankcode:     ['999991', '120001'],
          account_type: 'STATIC',        // permanent dedicated account
          businessid:   process.env.PAYVESSEL_BUSINESS_ID,
          // BVN/NIN required for STATIC accounts on Payvessel
          // Without BVN the account may still be created in test mode
          // In production you'll need to collect and pass user BVN
          // bvn: userBvn,
          // nin: userNin,
        }),
      }
    );

    const payvesselData = await payvesselRes.json();
    console.log('Payvessel status:', payvesselRes.status);
    console.log('Payvessel response:', JSON.stringify(payvesselData, null, 2));
    console.log('Using BASE URL:', BASE, '| Test mode:', isTestMode);

    // ── 6. Check for success ─────────────────────────────────────────
    if (!payvesselRes.ok || !payvesselData.status) {
      const msg = payvesselData?.message ?? payvesselData?.error ?? 'Failed to create virtual account';
      console.error('Payvessel error:', msg);
      return NextResponse.json(
        { success: false, message: msg },
        { status: 500 }
      );
    }

    // ── 7. Normalise response → our schema ───────────────────────────
    // Payvessel returns: { status: true, banks: [...], business: "..." }
    const rawBanks: any[] = payvesselData?.banks ?? [];

    if (!rawBanks.length) {
      return NextResponse.json(
        { success: false, message: 'No virtual accounts returned. Try again.' },
        { status: 500 }
      );
    }

    const accounts = rawBanks.map((b: any) => ({
      bankName:          b.bankName      ?? '',
      bankCode:          '',
      accountNumber:     b.accountNumber ?? '',
      accountName:       b.accountName   ?? fullName,
      trackingReference: b.trackingReference ?? '',
    }));

    // Use the first account's trackingReference as our lookup key for webhooks
    const trackingReference = accounts[0].trackingReference;

    // ── 8. Save to Supabase ──────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        monnify_accounts:          accounts,
        monnify_account_reference: trackingReference,  // used by webhook
      })
      .eq('id', userId);

    if (updateErr) {
      console.error('Supabase update error:', updateErr);
      return NextResponse.json(
        { success: false, message: 'Account created but could not be saved. Contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, accounts });

  } catch (err: any) {
    console.error('create-virtual-account error:', err);
    return NextResponse.json(
      { success: false, message: err.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}