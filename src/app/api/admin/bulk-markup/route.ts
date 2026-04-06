import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { network, percent } = await request.json();
  let query = supabase.from('data_plans').select('id, cost_price');
  if (network !== 'ALL') query = query.eq('network_name', network);

  const { data: plans, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  for (const plan of (plans || [])) {
    const newPrice = parseFloat((plan.cost_price * (1 + percent / 100)).toFixed(2));
    const { error: e } = await supabase
      .from('data_plans').update({ selling_price: newPrice }).eq('id', plan.id);
    if (!e) updated++;
  }
  return NextResponse.json({ success: true, updated });
}