import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { title, message, type, action_url, target } = await request.json();
    // target: 'all' | { user_id: string }

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message required' }, { status: 400 });
    }

    if (target === 'all' || !target) {
      // Broadcast — insert one row with user_id = NULL
      const { error } = await supabase
        .from('notifications')
        .insert({ title, message, type: type || 'info', action_url: action_url || null, user_id: null });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, sent_to: 'all users' });

    } else if (target.user_id) {
      // Single user
      const { error } = await supabase
        .from('notifications')
        .insert({ title, message, type: type || 'info', action_url: action_url || null, user_id: target.user_id });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, sent_to: target.user_id });

    } else if (target.user_ids && Array.isArray(target.user_ids)) {
      // Multiple specific users
      const rows = target.user_ids.map((uid: string) => ({
        title, message, type: type || 'info', action_url: action_url || null, user_id: uid,
      }));

      const { error } = await supabase.from('notifications').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, sent_to: `${target.user_ids.length} users` });
    }

    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}