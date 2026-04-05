import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');

    if (!network) {
      return NextResponse.json(
        { error: 'Network required' },
        { status: 400 }
      );
    }

    const { data: plans, error } = await supabase
      .from('data_plans')
      .select('plan_code, plan_name, selling_price, duration, plan_type, is_active')
      .eq('network_id', network)
      .eq('is_active', true)
      .order('selling_price', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const transformed = (plans || []).map(plan => ({
      plan_code:     plan.plan_code,
      plan_name:     plan.plan_name,
      plan_amount:   plan.selling_price,
      plan_duration: plan.duration,
      plan_type:     plan.plan_type,
    }));

    return NextResponse.json(transformed);

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}