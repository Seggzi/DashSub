import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { id, field, value } = await request.json();
  if (!['selling_price', 'is_active'].includes(field))
    return NextResponse.json({ error: 'Field not allowed' }, { status: 403 });

  const { data, error } = await supabase
    .from('data_plans').update({ [field]: value }).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}