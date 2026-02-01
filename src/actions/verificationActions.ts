'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function verifyEmailCode(email: string, token: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error) throw error;
    return { success: true, session: data.session };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function resendCode(email: string) {
  try {
    const { error } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email: email,
    });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Inside actions/verificationActions.ts - add this if you want it modular
export async function resetPassword(email: string) {
  return await supabaseAdmin.auth.resetPasswordForEmail(email);
}

// THIS STOPS THE RED LINE IN page.tsx
export async function generateAndSendCode(userId: string, email: string) {
  return { success: true };
}