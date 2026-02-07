import { NextRequest, NextResponse } from 'next/server';

const CLUBKONNECT_USER_ID = process.env.CLUBKONNECT_USER_ID;
const CLUBKONNECT_BASE_URL = process.env.CLUBKONNECT_BASE_URL || 'https://www.nellobytesystems.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');

    console.log('📡 Get data plans request for network:', network);

    if (!network) {
      return NextResponse.json(
        { error: 'Network parameter is required' },
        { status: 400 }
      );
    }

    if (!CLUBKONNECT_USER_ID) {
      console.error('❌ CLUBKONNECT_USER_ID not configured');
      return NextResponse.json(
        { error: 'API credentials not configured' },
        { status: 500 }
      );
    }

    const url = `${CLUBKONNECT_BASE_URL}/APIDatabundlePlansV2.asp?UserID=${CLUBKONNECT_USER_ID}`;
    
    console.log('🌐 Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    console.log('📥 Raw response (first 500 chars):', text.substring(0, 500));

    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e);
      console.error('Response text:', text);
      return NextResponse.json(
        { error: 'Invalid JSON response from provider' },
        { status: 500 }
      );
    }

    console.log('📦 Parsed data type:', typeof parsedData);
    console.log('📦 Is array?', Array.isArray(parsedData));
    
    // Handle different response formats
    let allPlans = [];
    
    if (Array.isArray(parsedData)) {
      // Response is already an array
      allPlans = parsedData;
    } else if (parsedData && typeof parsedData === 'object') {
      // Response might be an object with a data/plans property
      if (parsedData.plans && Array.isArray(parsedData.plans)) {
        allPlans = parsedData.plans;
      } else if (parsedData.data && Array.isArray(parsedData.data)) {
        allPlans = parsedData.data;
      } else {
        // Try to get all values from the object
        allPlans = Object.values(parsedData);
      }
    } else {
      console.error('❌ Unexpected response format:', parsedData);
      return NextResponse.json(
        { error: 'Unexpected response format from provider' },
        { status: 500 }
      );
    }

    console.log('📊 Total plans before filter:', allPlans.length);

    // Filter plans by network
    const networkPlans = allPlans.filter((plan: any) => {
      // Handle different possible field names
      return plan.network === network || 
             plan.Network === network || 
             plan.NETWORK === network ||
             plan.mobile_network === network;
    });

    console.log(`✅ Found ${networkPlans.length} plans for network ${network}`);

    // If no plans found, log sample plan to see structure
    if (networkPlans.length === 0 && allPlans.length > 0) {
      console.log('Sample plan structure:', JSON.stringify(allPlans[0], null, 2));
    }

    // Transform to our format
    const transformedPlans = networkPlans.map((plan: any) => ({
      plan_code: plan.dataplan_id || plan.plan_id || plan.id,
      plan_name: plan.plan || plan.plan_name || plan.name,
      plan_amount: parseFloat(plan.plan_amount || plan.amount || plan.price || '0'),
      plan_duration: plan.validity || plan.duration || plan.period || 'N/A',
    }));

    console.log('✅ Returning', transformedPlans.length, 'transformed plans');

    return NextResponse.json(transformedPlans);

  } catch (error: any) {
    console.error('❌ Error fetching data plans:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch data plans: ' + error.message },
      { status: 500 }
    );
  }
}