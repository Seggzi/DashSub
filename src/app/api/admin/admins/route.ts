import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: adminRows, error } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get profile info for each admin
    const userIds = (adminRows || []).map(a => a.user_id);
    let profileMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    }

    // Also get email from auth.users for any missing
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const authMap: Record<string, string> = {};
    (authUsers?.users || []).forEach(u => { authMap[u.id] = u.email || ''; });

    const admins = (adminRows || []).map(a => ({
      ...a,
      full_name: profileMap[a.user_id]?.full_name || '',
      email:     profileMap[a.user_id]?.email || authMap[a.user_id] || '',
    }));

    return NextResponse.json({ admins });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, role = 'admin' } = await request.json();

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // Find user by email in auth
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const user = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ error: 'No user found with that email. They must sign up first.' }, { status: 404 });
    }

    // Check if already admin
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'User is already an admin' }, { status: 409 });
    }

    const { error } = await supabase
      .from('admin_users')
      .insert({ user_id: user.id, role, permissions: [] });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    // Prevent removing super_admin
    const { data: admin } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user_id)
      .single();

    if (admin?.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot remove super admin' }, { status: 403 });
    }

    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('user_id', user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}