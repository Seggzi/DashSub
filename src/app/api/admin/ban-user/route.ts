import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user_id, ban, reason } = await request.json();

    if (!user_id || typeof ban !== 'boolean') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Update profile ban status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_banned:  ban,
        banned_at:  ban ? new Date().toISOString() : null,
        ban_reason: ban ? (reason || null) : null,
      })
      .eq('id', user_id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Also ban/unban in Supabase Auth (prevents login entirely)
    if (ban) {
      const { error: authError } = await supabase.auth.admin.updateUserById(user_id, {
        ban_duration: '876600h', // ~100 years = effectively permanent
      });
      if (authError) {
        // Non-fatal — profile is already marked banned
        console.error('Auth ban error:', authError.message);
      }
    } else {
      const { error: authError } = await supabase.auth.admin.updateUserById(user_id, {
        ban_duration: 'none',
      });
      if (authError) {
        console.error('Auth unban error:', authError.message);
      }
    }

    return NextResponse.json({ success: true, banned: ban });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}