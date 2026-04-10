import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { id, ids, user_id, is_broadcast } = await request.json();
    const toMark = ids ?? (id ? [id] : []);
    if (!toMark.length || !user_id) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    if (is_broadcast) {
      // For broadcasts: insert into notification_reads table
      const rows = toMark.map((nid: string) => ({
        user_id,
        notification_id: nid,
      }));
      await supabase.from('notification_reads').upsert(rows, { onConflict: 'user_id,notification_id' });
    } else {
      // For personal notifications: update is_read directly
      await supabase.from('notifications').update({ is_read: true }).in('id', toMark);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}