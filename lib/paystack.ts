const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface PaystackCustomer {
  customer_code: string;
  email: string;
}

interface PaystackDedicatedAccount {
  account_number: string;
  account_name: string;
  bank: {
    name: string;
    slug: string;
  };
}

export const paystackService = {
  async createOrGetCustomer(
    email: string,
    firstName: string,
    lastName: string,
    phone: string
  ): Promise<PaystackCustomer> {
    try {
      // First, try to fetch existing customer
      const fetchResponse = await fetch(
        `${PAYSTACK_BASE_URL}/customer/${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        console.log('✅ Found existing customer');
        return data.data;
      }

      // If not found, create new customer
      const createResponse = await fetch(`${PAYSTACK_BASE_URL}/customer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
        }),
      });

      const data = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(data.message || 'Failed to create customer');
      }

      console.log('✅ Created new customer');
      return data.data;
    } catch (error: any) {
      console.error('❌ Customer error:', error);
      throw error;
    }
  },

  async createDedicatedAccount(params: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    preferred_bank: string;
    account_number?: string;
  }): Promise<PaystackDedicatedAccount> {
    try {
      const response = await fetch(
        `${PAYSTACK_BASE_URL}/dedicated_account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: params.email,
            preferred_bank: params.preferred_bank,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Paystack error:', data);
        throw new Error(data.message || 'Failed to create dedicated account');
      }

      console.log('✅ Dedicated account created:', data.data.account_number);
      return data.data;
    } catch (error: any) {
      console.error('❌ Dedicated account error:', error);
      throw error;
    }
  },
};