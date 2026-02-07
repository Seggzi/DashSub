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

    console.log('📡 Get data plans from database for network:', network);

    if (!network) {
      return NextResponse.json(
        { error: 'Network parameter is required' },
        { status: 400 }
      );
    }

    // Fetch from Supabase
    const { data: plans, error } = await supabase
      .from('data_plans')
      .select('*')
      .eq('network_id', network)
      .eq('is_active', true)
      .order('selling_price', { ascending: true });

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch plans from database' },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${plans.length} plans for network ${network}`);

    // Transform to frontend format
    const transformedPlans = plans.map((plan) => ({
      plan_code: plan.plan_code,
      plan_name: plan.plan_name,
      plan_amount: plan.selling_price, // User sees selling price
      plan_duration: plan.duration,
    }));

    return NextResponse.json(transformedPlans);

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}