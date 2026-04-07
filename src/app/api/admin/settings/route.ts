import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const settings: Record<string, any> = {};
  data?.forEach(row => { settings[row.key] = row.value; });
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const { key, value } = await request.json();
  if (!key || !value) return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });

  const { error } = await supabase.from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}