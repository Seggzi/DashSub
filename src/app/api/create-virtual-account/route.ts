import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { monnifyService } from '@/lib/monnify';

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
  console.log('\n🏦 Virtual account creation request (Monnify)');
  
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
      console.error('❌ Profile not found:', profileError);
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if user already has virtual accounts
    if (profile.monnify_account_reference) {
      console.log('ℹ️ User already has virtual accounts, fetching latest...');
      
      try {
        const accountDetails = await monnifyService.getReservedAccountDetails(
          profile.monnify_account_reference
        );

        return NextResponse.json({
          success: true,
          message: 'Virtual accounts already exist',
          accounts: accountDetails.accounts,
        });
      } catch (error) {
        console.log('⚠️ Error fetching existing account, will create new one');
      }
    }

    // Get user email
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    
    if (!authUser?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'User email not found' },
        { status: 404 }
      );
    }

    // Prepare account name
    const fullName = profile.full_name || authUser.user.email.split('@')[0];
    // Monnify recommends uppercase for account names
    const accountName = `DASHSUB ${fullName}`.toUpperCase().substring(0, 40);

    console.log('👤 Creating account for:', authUser.user.email);
    console.log('📛 Account name:', accountName);
    console.log('🆔 Account reference:', profile.account_number);

    // Create reserved account with Monnify
    const reservedAccount = await monnifyService.createReservedAccount({
      accountReference: profile.account_number,
      accountName: accountName,
      currencyCode: 'NGN',
      contractCode: process.env.MONNIFY_CONTRACT_CODE!,
      customerEmail: authUser.user.email,
      customerName: fullName,
      getAllAvailableBanks: true, // Get all available banks
    });

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        monnify_account_reference: reservedAccount.accountReference,
        monnify_accounts: reservedAccount.accounts,
        // Store first account as primary for backward compatibility
        virtual_account_number: reservedAccount.accounts[0]?.accountNumber,
        virtual_account_bank: reservedAccount.accounts[0]?.bankName,
        virtual_account_name: reservedAccount.accounts[0]?.accountName,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to save virtual accounts:', updateError);
      throw updateError;
    }

    console.log('✅ Virtual accounts created and saved to database');

    return NextResponse.json({
      success: true,
      message: 'Virtual accounts created successfully',
      accounts: reservedAccount.accounts,
    });
  } catch (error: any) {
    console.error('❌ Error creating virtual account:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Failed to create virtual account',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}