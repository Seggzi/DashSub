import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { id, ids } = await request.json();
  const toMark = ids ?? (id ? [id] : []);
  if (!toMark.length) return NextResponse.json({ error: 'No ids' }, { status: 400 });

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', toMark);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}