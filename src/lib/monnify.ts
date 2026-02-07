const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY!;
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY!;
const MONNIFY_CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE!;
const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';

interface MonnifyAuthResponse {
  accessToken: string;
}

interface MonnifyReservedAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
}

export const monnifyService = {
  // Get access token
  async getAccessToken(): Promise<string> {
    try {
      const credentials = Buffer.from(
        `${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`
      ).toString('base64');

      const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.responseMessage || 'Failed to authenticate');
      }

      return data.responseBody.accessToken;
    } catch (error: any) {
      console.error('❌ Monnify auth error:', error);
      throw error;
    }
  },

  // Create reserved account
  async createReservedAccount(params: {
    accountReference: string; // Unique user ID
    accountName: string; // User's full name
    customerEmail: string;
    customerName: string;
  }): Promise<MonnifyReservedAccount> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountReference: params.accountReference,
            accountName: params.accountName,
            currencyCode: 'NGN',
            contractCode: MONNIFY_CONTRACT_CODE,
            customerEmail: params.customerEmail,
            customerName: params.customerName,
            getAllAvailableBanks: false, // Set to true to get multiple bank accounts
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Monnify error:', data);
        throw new Error(data.responseMessage || 'Failed to create reserved account');
      }

      const account = data.responseBody.accounts[0]; // Get first account

      console.log('✅ Reserved account created:', account.accountNumber);

      return {
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        bankName: account.bankName,
        bankCode: account.bankCode,
      };
    } catch (error: any) {
      console.error('❌ Monnify error:', error);
      throw error;
    }
  },

  // Get reserved account details
  async getReservedAccount(accountReference: string): Promise<MonnifyReservedAccount | null> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts/${accountReference}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(data.responseMessage);
      }

      const account = data.responseBody.accounts[0];

      return {
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        bankName: account.bankName,
        bankCode: account.bankCode,
      };
    } catch (error: any) {
      console.error('❌ Monnify error:', error);
      throw error;
    }
  },
};