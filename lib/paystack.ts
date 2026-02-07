interface CreateDedicatedAccountParams {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  preferred_bank?: string; // 'wema-bank' or 'titan-paystack'
  account_number: string; // User's DashSub account number
}

interface PaystackVirtualAccount {
  bank: {
    name: string;
    id: number;
    slug: string;
  };
  account_name: string;
  account_number: string;
  assigned: boolean;
  currency: string;
  active: boolean;
  customer: {
    id: number;
    customer_code: string;
    email: string;
  };
}

export class PaystackService {
  private apiKey: string;
  private baseUrl = 'https://api.paystack.co';

  constructor() {
    this.apiKey = process.env.PAYSTACK_SECRET_KEY!;
  }

  private async request(endpoint: string, method: string = 'GET', data?: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Paystack API Error:', result);
      throw new Error(result.message || 'Paystack request failed');
    }

    return result;
  }

  async createOrGetCustomer(email: string, firstName: string, lastName: string, phone: string) {
    console.log('📝 Creating/Getting Paystack customer...');
    
    try {
      // Try to fetch existing customer
      const result = await this.request(`/customer/${email}`);
      console.log('✅ Existing customer found:', result.data.customer_code);
      return result.data;
    } catch (error) {
      // Customer doesn't exist, create new one
      console.log('🆕 Creating new customer...');
      const result = await this.request('/customer', 'POST', {
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
      });
      console.log('✅ Customer created:', result.data.customer_code);
      return result.data;
    }
  }

  async createDedicatedAccount(params: CreateDedicatedAccountParams): Promise<PaystackVirtualAccount> {
    console.log('🏦 Creating dedicated virtual account...');
    
    const result = await this.request('/dedicated_account', 'POST', {
      email: params.email,
      first_name: params.first_name,
      last_name: params.last_name,
      phone: params.phone,
      preferred_bank: params.preferred_bank || 'wema-bank', // or 'titan-paystack'
      country: 'NG',
      account_number: params.account_number, // Links to DashSub account
    });

    console.log('✅ Virtual account created:', result.data.account_number);
    return result.data;
  }

  async getDedicatedAccounts(customerCode: string) {
    console.log('🔍 Fetching dedicated accounts...');
    const result = await this.request(`/dedicated_account?customer=${customerCode}`);
    return result.data;
  }
}

export const paystackService = new PaystackService();