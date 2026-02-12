import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ isAdmin: false });
    }

    // Check if user is admin (using service role to bypass RLS)
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Admin check error:', error);
      return NextResponse.json({ isAdmin: false });
    }

    return NextResponse.json({ 
      isAdmin: !!adminUser,
      role: adminUser?.role,
    });
  } catch (error) {
    console.error('Error checking admin:', error);
    return NextResponse.json({ isAdmin: false });
  }
}