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
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if already has virtual account
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

    // Get user email
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    
    if (!authUser?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'User email not found' },
        { status: 404 }
      );
    }

    const fullName = profile.full_name || 'DashSub User';

    console.log('👤 Creating Monnify account for:', authUser.user.email);

    // Create Monnify reserved account
    const reservedAccount = await monnifyService.createReservedAccount({
      accountReference: userId, // Use user ID as unique reference
      accountName: fullName,
      customerEmail: authUser.user.email,
      customerName: fullName,
    });

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        virtual_account_number: reservedAccount.accountNumber,
        virtual_account_bank: reservedAccount.bankName,
        virtual_account_name: reservedAccount.accountName,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to save:', updateError);
      throw updateError;
    }

    console.log('✅ Monnify virtual account created!');

    return NextResponse.json({
      success: true,
      message: 'Virtual account created successfully',
      virtualAccount: {
        account_number: reservedAccount.accountNumber,
        account_name: reservedAccount.accountName,
        bank_name: reservedAccount.bankName,
      },
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create virtual account' },
      { status: 500 }
    );
  }
}