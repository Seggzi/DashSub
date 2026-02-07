import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLUBKONNECT_USER_ID = process.env.CLUBKONNECT_USER_ID!;
const MARKUP_PERCENTAGE = 0.15; // 15% markup

const NETWORK_MAPPING: { [key: string]: { id: string; name: string } } = {
  'MTN': { id: '01', name: 'MTN' },
  'Glo': { id: '02', name: 'Glo' },
  'm_9mobile': { id: '03', name: '9mobile' },
  'Airtel': { id: '04', name: 'Airtel' },
};

async function syncDataPlans() {
  console.log('🔄 Syncing data plans from Clubkonnect...');
  console.log(`💰 Markup: ${MARKUP_PERCENTAGE * 100}%\n`);

  // Verify environment variables
  if (!CLUBKONNECT_USER_ID) {
    throw new Error('CLUBKONNECT_USER_ID not found in environment variables');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL not found in environment variables');
  }

  console.log('✅ Environment variables loaded');
  console.log(`📡 Clubkonnect User ID: ${CLUBKONNECT_USER_ID}\n`);

  try {
    // Fetch plans from Clubkonnect
    const url = `https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${CLUBKONNECT_USER_ID}`;
    console.log(`🌐 Fetching from: ${url}\n`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    console.log(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const text = await response.text();
    console.log(`📥 Received ${text.length} characters\n`);

    let rawData;
    try {
      rawData = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON');
      console.error('First 500 chars:', text.substring(0, 500));
      throw new Error('Invalid JSON response from Clubkonnect');
    }

    const mobileNetworks = rawData.MOBILE_NETWORK;

    if (!mobileNetworks) {
      console.error('Response structure:', JSON.stringify(rawData, null, 2).substring(0, 500));
      throw new Error('MOBILE_NETWORK not found in response');
    }

    const allPlans: any[] = [];

    // Parse each network
    for (const [networkKey, networkData] of Object.entries(mobileNetworks)) {
      const networkInfo = NETWORK_MAPPING[networkKey];
      if (!networkInfo) {
        console.log(`⚠️  Skipping unknown network: ${networkKey}`);
        continue;
      }

      const networkArray = networkData as any[];
      const products = networkArray[0]?.PRODUCT || [];

      console.log(`📊 ${networkInfo.name}: ${products.length} plans found`);

      for (const product of products) {
        const costPrice = parseFloat(product.PRODUCT_AMOUNT);
        const sellingPrice = Math.ceil(costPrice * (1 + MARKUP_PERCENTAGE));
        const profit = sellingPrice - costPrice;

        allPlans.push({
          network_id: networkInfo.id,
          network_name: networkInfo.name,
          plan_code: product.PRODUCT_ID,
          plan_name: product.PRODUCT_NAME,
          cost_price: costPrice,
          selling_price: sellingPrice,
          duration: extractDuration(product.PRODUCT_NAME),
          is_active: true,
        });

        // Log sample plan
        if (allPlans.length === 1) {
          console.log(`\n📋 Sample Plan:`);
          console.log(`   Name: ${product.PRODUCT_NAME}`);
          console.log(`   Cost: ₦${costPrice}`);
          console.log(`   Selling: ₦${sellingPrice}`);
          console.log(`   Profit: ₦${profit}\n`);
        }
      }
    }

    console.log(`\n📥 Total plans to sync: ${allPlans.length}`);

    if (allPlans.length === 0) {
      throw new Error('No plans found to sync');
    }

    console.log(`💾 Upserting to database...\n`);

    // Insert plans in batches
    const BATCH_SIZE = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allPlans.length; i += BATCH_SIZE) {
      const batch = allPlans.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allPlans.length / BATCH_SIZE);
      
      const { error } = await supabase
        .from('data_plans')
        .upsert(batch, {
          onConflict: 'network_id,plan_code',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`❌ Batch ${batchNumber}/${totalBatches} failed:`, error.message);
        errorCount += batch.length;
      } else {
        console.log(`✅ Batch ${batchNumber}/${totalBatches} synced (${batch.length} plans)`);
        successCount += batch.length;
      }
    }

    console.log(`\n🎉 Sync completed!`);
    console.log(`✅ Success: ${successCount} plans`);
    if (errorCount > 0) {
      console.log(`❌ Failed: ${errorCount} plans`);
    }
    
    // Show profit summary
    console.log(`\n💰 Profit Summary:`);
    const totalCost = allPlans.reduce((sum, p) => sum + p.cost_price, 0);
    const totalSelling = allPlans.reduce((sum, p) => sum + p.selling_price, 0);
    const totalProfit = totalSelling - totalCost;
    console.log(`   Total Cost: ₦${totalCost.toLocaleString()}`);
    console.log(`   Total Selling: ₦${totalSelling.toLocaleString()}`);
    console.log(`   Total Profit Potential: ₦${totalProfit.toLocaleString()}\n`);

  } catch (error: any) {
    console.error('\n❌ Sync failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

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

// Run the sync
syncDataPlans()
  .then(() => {
    console.log('👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });