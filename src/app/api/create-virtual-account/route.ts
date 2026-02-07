import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { paystackService } from '@/lib/paystack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  console.log('\n🏦 Virtual account creation request');
  
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if user already has a virtual account
    if (profile.virtual_account_number) {
      return NextResponse.json({
        success: true,
        message: 'Virtual account already exists',
        virtualAccount: {
          account_number: profile.virtual_account_number,
          account_name: profile.virtual_account_name,
          bank_name: profile.virtual_account_bank,
        },
      });
    }

    // Get user email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    
    if (!authUser?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'User email not found' },
        { status: 404 }
      );
    }

    // Parse full name
    const nameParts = (profile.full_name || '').split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'DashSub';

    console.log('👤 User:', authUser.user.email);
    console.log('📱 Phone:', profile.phone_number);
    console.log('🆔 Account Number:', profile.account_number);

    // Create or get Paystack customer
    const customer = await paystackService.createOrGetCustomer(
      authUser.user.email,
      firstName,
      lastName,
      profile.phone_number || '08000000000'
    );

    // Create dedicated virtual account
    const virtualAccount = await paystackService.createDedicatedAccount({
      email: authUser.user.email,
      first_name: firstName,
      last_name: lastName,
      phone: profile.phone_number || '08000000000',
      preferred_bank: 'wema-bank', // or 'titan-paystack' for Titan Paystack
      account_number: profile.account_number,
    });

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        virtual_account_number: virtualAccount.account_number,
        virtual_account_bank: virtualAccount.bank.name,
        virtual_account_name: virtualAccount.account_name,
        paystack_customer_code: customer.customer_code,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to save virtual account:', updateError);
      throw updateError;
    }

    console.log('✅ Virtual account created and saved');

    return NextResponse.json({
      success: true,
      message: 'Virtual account created successfully',
      virtualAccount: {
        account_number: virtualAccount.account_number,
        account_name: virtualAccount.account_name,
        bank_name: virtualAccount.bank.name,
      },
    });
  } catch (error: any) {
    console.error('❌ Error creating virtual account:', error);
    
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create virtual account' },
      { status: 500 }
    );
  }
}