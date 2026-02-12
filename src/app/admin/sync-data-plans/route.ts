import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLUBKONNECT_USER_ID = process.env.CLUBKONNECT_USER_ID!;

const NETWORK_MAPPING: { [key: string]: { id: string; name: string } } = {
  'MTN': { id: '01', name: 'MTN' },
  'Glo': { id: '02', name: 'Glo' },
  'm_9mobile': { id: '03', name: '9mobile' },
  'Airtel': { id: '04', name: 'Airtel' },
};

function extractDuration(planName: string): string {
  const durationMap = [
    { pattern: /1 day/i, value: '1 day' },
    { pattern: /2 days/i, value: '2 days' },
    { pattern: /3 days/i, value: '3 days' },
    { pattern: /7 days/i, value: '7 days' },
    { pattern: /14 days/i, value: '14 days' },
    { pattern: /30 days/i, value: '30 days' },
    { pattern: /60 days/i, value: '60 days' },
    { pattern: /90 days/i, value: '90 days' },
    { pattern: /180 days/i, value: '180 days' },
    { pattern: /365 days/i, value: '365 days' },
  ];

  for (const { pattern, value } of durationMap) {
    if (pattern.test(planName)) {
      return value;
    }
  }

  return 'N/A';
}

export async function POST(request: NextRequest) {
  console.log('\n🔄 Admin: Syncing data plans from Clubkonnect');

  try {
    // Get markup percentages from service_pricing
    const { data: pricingData } = await supabase
      .from('service_pricing')
      .select('*')
      .eq('service_type', 'data');

    const markupMap: { [key: string]: number } = {};
    pricingData?.forEach((p) => {
      markupMap[p.provider.toLowerCase()] = p.commission_percentage / 100;
    });

    // Fetch from Clubkonnect
    const response = await fetch(
      `https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${CLUBKONNECT_USER_ID}`
    );

    const rawData = await response.json();
    const mobileNetworks = rawData.MOBILE_NETWORK;

    let totalSynced = 0;

    for (const [networkKey, networkData] of Object.entries(mobileNetworks)) {
      const networkInfo = NETWORK_MAPPING[networkKey];
      if (!networkInfo) continue;

      const networkArray = networkData as any[];
      const products = networkArray[0]?.PRODUCT || [];

      const markup = markupMap[networkInfo.name.toLowerCase()] || 0.15;

      for (const product of products) {
        const costPrice = parseFloat(product.PRODUCT_AMOUNT);
        const sellingPrice = Math.ceil(costPrice * (1 + markup));

        await supabase.from('data_plans').upsert(
          {
            network_id: networkInfo.id,
            network_name: networkInfo.name,
            plan_code: product.PRODUCT_ID,
            plan_name: product.PRODUCT_NAME,
            cost_price: costPrice,
            selling_price: sellingPrice,
            duration: extractDuration(product.PRODUCT_NAME),
            is_active: true,
          },
          {
            onConflict: 'network_id,plan_code',
          }
        );

        totalSynced++;
      }
    }

    console.log(`✅ Synced ${totalSynced} plans`);

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${totalSynced} data plans`,
    });
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}