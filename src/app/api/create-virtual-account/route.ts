import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
const PAYVESSEL_BASE = process.env.PAYVESSEL_BASE_URL ?? 'https://api.payvessel.com';
 
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
 
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'userId is required' },
        { status: 400 }
      );
    }
 
    // ── 1. Load user profile ─────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, monnify_accounts, payvessel_customer_id')
      .eq('id', userId)
      .single();
 
    if (profileErr || !profile) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
 
    // ── 2. Already has accounts? Return them — one account per user ──
    if (
      profile.monnify_accounts &&
      Array.isArray(profile.monnify_accounts) &&
      profile.monnify_accounts.length > 0
    ) {
      return NextResponse.json({
        success: true,
        message:  'Virtual account already exists',
        accounts: profile.monnify_accounts,
      });
    }
 
    // ── 3. Resolve email ─────────────────────────────────────────────
    let userEmail = profile.email;
    if (!userEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? `user_${userId.slice(0, 8)}@dashsub.ng`;
    }
 
    const fullName = profile.full_name?.trim() || userEmail.split('@')[0];
 
    // ── 4. Create customer on Payvessel (if not already) ─────────────
    let customerId: string = profile.payvessel_customer_id ?? '';
 
    if (!customerId) {
      const custRes = await fetch(`${PAYVESSEL_BASE}/api/v3/requests/customer`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYVESSEL_SECRET_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          customerEmail:     userEmail,
          customerFirstname: fullName.split(' ')[0] ?? fullName,
          customerLastname:  fullName.split(' ').slice(1).join(' ') || 'User',
          customerPhone:     '08000000000', // placeholder — update if you collect phone
        }),
      });
 
      if (!custRes.ok) {
        const errText = await custRes.text();
        console.error('Payvessel customer error:', errText);
        return NextResponse.json(
          { success: false, message: 'Failed to create customer on Payvessel' },
          { status: 500 }
        );
      }
 
      const custData = await custRes.json();
      customerId     = custData?.data?.id ?? custData?.data?.customerId ?? '';
 
      if (!customerId) {
        console.error('Payvessel returned no customer id:', custData);
        return NextResponse.json(
          { success: false, message: 'Payvessel did not return a customer ID' },
          { status: 500 }
        );
      }
 
      // Save customer id immediately so we don't create duplicates
      await supabase
        .from('profiles')
        .update({ payvessel_customer_id: customerId })
        .eq('id', userId);
    }
 
    // ── 5. Create dedicated virtual account ─────────────────────────
    //    Payvessel supports multiple banks — PalmPay (999991), Wema (035)
    const vaRes = await fetch(`${PAYVESSEL_BASE}/api/v3/requests/virtualaccount`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYVESSEL_SECRET_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        customerId,
        // Request PalmPay + Wema accounts (Payvessel bank codes)
        bankCode:       ['999991', '035'],
        // accountName shown on the bank app when someone sends money
        accountName:    `DashSub ${fullName}`,
        // amount: 0 means unlimited (dedicated account, not one-time)
        amount:          0,
        // Reference ties this account to our user — used in webhook lookup
        customerReference: `DASHSUB_${userId.replace(/-/g, '').slice(0, 20)}`,
      }),
    });
 
    if (!vaRes.ok) {
      const errText = await vaRes.text();
      console.error('Payvessel virtual account error:', errText);
      return NextResponse.json(
        { success: false, message: 'Failed to create virtual account. Please try again.' },
        { status: 500 }
      );
    }
 
    const vaData = await vaRes.json();
 
    // Payvessel returns accounts as an array
    const rawAccounts: any[] = vaData?.data?.accounts ?? vaData?.data ?? [];
 
    if (!rawAccounts.length) {
      console.error('Payvessel returned no accounts:', vaData);
      return NextResponse.json(
        { success: false, message: 'No virtual accounts returned. Contact support.' },
        { status: 500 }
      );
    }
 
    // ── 6. Normalise into our schema ─────────────────────────────────
    const accounts = rawAccounts.map((acc: any) => ({
      bankName:      acc.bankName      ?? acc.bank_name      ?? 'Unknown Bank',
      bankCode:      acc.bankCode      ?? acc.bank_code      ?? '',
      accountNumber: acc.accountNumber ?? acc.account_number ?? '',
      accountName:   acc.accountName   ?? acc.account_name   ?? `DashSub ${fullName}`,
    }));
 
    const customerReference = `DASHSUB_${userId.replace(/-/g, '').slice(0, 20)}`;
 
    // ── 7. Persist to Supabase ───────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        monnify_accounts:          accounts,       // reuse existing column
        monnify_account_reference: customerReference,
        payvessel_customer_id:     customerId,
      })
      .eq('id', userId);
 
    if (updateErr) {
      console.error('Supabase update error:', updateErr);
      return NextResponse.json(
        {
          success: false,
          message: 'Account created but could not be saved. Please contact support.',
        },
        { status: 500 }
      );
    }
 
    return NextResponse.json({ success: true, accounts });
  } catch (err: any) {
    console.error('create-virtual-account unhandled error:', err);
    return NextResponse.json(
      { success: false, message: err.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
 