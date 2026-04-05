import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    // Check if plans already exist — don't overwrite if admin edited them
    const { count } = await supabase
      .from('data_plans')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      return NextResponse.json({
        success: true,
        message: `ℹ️ ${count} plans already exist. Use admin panel to edit.`,
        count,
      });
    }

    // Only seed if table is empty
    const SEED_PLANS = getSeedPlans();
    const { error } = await supabase.from('data_plans').insert(SEED_PLANS);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `✅ Seeded ${SEED_PLANS.length} plans`,
      count: SEED_PLANS.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function applyMarkup(price: number, percent = 15): number {
  return parseFloat((price * (1 + percent / 100)).toFixed(2));
}

function getSeedPlans() {
  const RAW = [
    // MTN
    { network_id: '1', network_name: 'MTN', plan_code: '353', plan_name: '1GB', cost_price: 803, duration: '30 days', plan_type: 'SME2' },
    { network_id: '1', network_name: 'MTN', plan_code: '354', plan_name: '2GB', cost_price: 1606, duration: '30 days', plan_type: 'SME2' },
    { network_id: '1', network_name: 'MTN', plan_code: '419', plan_name: '3GB', cost_price: 2409, duration: '30 days', plan_type: 'SME2' },
    { network_id: '1', network_name: 'MTN', plan_code: '468', plan_name: '5GB', cost_price: 4015, duration: '30 days', plan_type: 'SME2' },
    { network_id: '1', network_name: 'MTN', plan_code: '357', plan_name: '10GB', cost_price: 8050, duration: '30 days', plan_type: 'SME2' },
    { network_id: '1', network_name: 'MTN', plan_code: '646', plan_name: '500MB', cost_price: 300, duration: '7 days', plan_type: 'SME' },
    { network_id: '1', network_name: 'MTN', plan_code: '486', plan_name: '1GB', cost_price: 750, duration: '30 days', plan_type: 'SME' },
    { network_id: '1', network_name: 'MTN', plan_code: '506', plan_name: '2GB', cost_price: 1400, duration: '30 days', plan_type: 'SME' },
    { network_id: '1', network_name: 'MTN', plan_code: '355', plan_name: '3GB', cost_price: 1740, duration: '30 days', plan_type: 'SME' },
    { network_id: '1', network_name: 'MTN', plan_code: '539', plan_name: '10GB', cost_price: 4343, duration: '30 days', plan_type: 'SME' },
    { network_id: '1', network_name: 'MTN', plan_code: '291', plan_name: '1GB', cost_price: 481.50, duration: '1 day', plan_type: 'GIFTING' },
    { network_id: '1', network_name: 'MTN', plan_code: '294', plan_name: '2.5GB', cost_price: 734, duration: '1 day', plan_type: 'GIFTING' },
    { network_id: '1', network_name: 'MTN', plan_code: '516', plan_name: '3.2GB', cost_price: 965, duration: '2 days', plan_type: 'GIFTING' },
    { network_id: '1', network_name: 'MTN', plan_code: '221', plan_name: '2GB', cost_price: 1447.50, duration: '30 days', plan_type: 'GIFTING' },
    { network_id: '1', network_name: 'MTN', plan_code: '401', plan_name: '10GB', cost_price: 4333.50, duration: '30 days', plan_type: 'GIFTING' },
    { network_id: '1', network_name: 'MTN', plan_code: '471', plan_name: '500MB', cost_price: 300, duration: '30 days', plan_type: 'DATA SHARE' },
    { network_id: '1', network_name: 'MTN', plan_code: '472', plan_name: '1GB', cost_price: 400, duration: '7 days', plan_type: 'DATA SHARE' },
    { network_id: '1', network_name: 'MTN', plan_code: '473', plan_name: '2GB', cost_price: 800, duration: '7 days', plan_type: 'DATA SHARE' },
    { network_id: '1', network_name: 'MTN', plan_code: '640', plan_name: '1GB', cost_price: 550, duration: '30 days', plan_type: 'DATA SHARE' },
    { network_id: '1', network_name: 'MTN', plan_code: '641', plan_name: '2GB', cost_price: 1100, duration: '30 days', plan_type: 'DATA SHARE' },
    // GLO
    { network_id: '2', network_name: 'GLO', plan_code: '574', plan_name: '50MB', cost_price: 46.50, duration: '1 day', plan_type: 'SME' },
    { network_id: '2', network_name: 'GLO', plan_code: '491', plan_name: '750MB', cost_price: 196, duration: '1 day', plan_type: 'SME' },
    { network_id: '2', network_name: 'GLO', plan_code: '492', plan_name: '1.5GB', cost_price: 290, duration: '1 day', plan_type: 'SME' },
    { network_id: '2', network_name: 'GLO', plan_code: '587', plan_name: '3.75GB', cost_price: 570, duration: '1 day', plan_type: 'SME' },
    { network_id: '2', network_name: 'GLO', plan_code: '493', plan_name: '2.5GB', cost_price: 478, duration: '2 days', plan_type: 'SME' },
    { network_id: '2', network_name: 'GLO', plan_code: '629', plan_name: '3.5GB', cost_price: 1020, duration: '7 days', plan_type: 'SME' },
    { network_id: '2', network_name: 'GLO', plan_code: '494', plan_name: '10GB', cost_price: 1888, duration: '7 days', plan_type: 'SME' },
    { network_id: '2', network_name: 'GLO', plan_code: '333', plan_name: '200MB', cost_price: 82, duration: '14 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '2', network_name: 'GLO', plan_code: '334', plan_name: '1GB', cost_price: 397, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '2', network_name: 'GLO', plan_code: '332', plan_name: '2GB', cost_price: 800, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '2', network_name: 'GLO', plan_code: '336', plan_name: '3GB', cost_price: 1191, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '2', network_name: 'GLO', plan_code: '329', plan_name: '5GB', cost_price: 1985, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '2', network_name: 'GLO', plan_code: '335', plan_name: '10GB', cost_price: 3970, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '2', network_name: 'GLO', plan_code: '635', plan_name: '1GB', cost_price: 285, duration: '7 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '2', network_name: 'GLO', plan_code: '637', plan_name: '5GB', cost_price: 1400, duration: '7 days', plan_type: 'CORPORATE GIFTING' },
    // AIRTEL
    { network_id: '3', network_name: 'AIRTEL', plan_code: '476', plan_name: '150MB', cost_price: 48, duration: '1 day', plan_type: 'SME' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '477', plan_name: '300MB', cost_price: 97, duration: '2 days', plan_type: 'SME' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '478', plan_name: '600MB', cost_price: 190, duration: '2 days', plan_type: 'SME' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '483', plan_name: '10GB', cost_price: 2910, duration: '30 days', plan_type: 'SME' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '534', plan_name: '13GB', cost_price: 4875, duration: '30 days', plan_type: 'SME' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '426', plan_name: '1.5GB', cost_price: 475, duration: '1 day', plan_type: 'GIFTING' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '429', plan_name: '1.5GB', cost_price: 950, duration: '7 days', plan_type: 'GIFTING' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '427', plan_name: '2GB', cost_price: 1425, duration: '30 days', plan_type: 'GIFTING' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '565', plan_name: '3GB', cost_price: 1900, duration: '30 days', plan_type: 'GIFTING' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '430', plan_name: '13GB', cost_price: 4850, duration: '30 days', plan_type: 'GIFTING' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '150', plan_name: '10GB', cost_price: 3800, duration: '30 days', plan_type: 'GIFTING' },
    { network_id: '3', network_name: 'AIRTEL', plan_code: '431', plan_name: '25GB', cost_price: 7600, duration: '30 days', plan_type: 'GIFTING' },
    // 9MOBILE
    { network_id: '4', network_name: '9MOBILE', plan_code: '182', plan_name: '500MB', cost_price: 237.50, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '298', plan_name: '1GB', cost_price: 475, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '299', plan_name: '2GB', cost_price: 950, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '303', plan_name: '3GB', cost_price: 1425, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '304', plan_name: '5GB', cost_price: 2375, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '305', plan_name: '10GB', cost_price: 4750, duration: '30 days', plan_type: 'CORPORATE GIFTING' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '755', plan_name: '2GB', cost_price: 970, duration: '30 days', plan_type: 'SPECIAL' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '762', plan_name: '5.2GB', cost_price: 2425, duration: '30 days', plan_type: 'SPECIAL' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '761', plan_name: '40MB', cost_price: 48.50, duration: '1 day', plan_type: 'SPECIAL' },
    { network_id: '4', network_name: '9MOBILE', plan_code: '752', plan_name: '83MB', cost_price: 97, duration: '1 day', plan_type: 'SPECIAL' },
  ];

  return RAW.map(p => ({
    ...p,
    selling_price: applyMarkup(p.cost_price),
    is_active: true,
  }));
}