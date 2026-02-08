interface CreateReservedAccountParams {
  accountReference: string;
  accountName: string;
  currencyCode: string;
  contractCode: string;
  customerEmail: string;
  customerName: string;
  getAllAvailableBanks?: boolean;
  preferredBanks?: string[];
}

interface MonnifyAccount {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface MonnifyVirtualAccount {
  contractCode: string;
  accountReference: string;
  accountName: string;
  currencyCode: string;
  customerEmail: string;
  customerName: string;
  accounts: MonnifyAccount[];
  collectionChannel: string;
  reservationReference: string;
  reservedAccountType: string;
  status: string;
  createdOn: string;
}

export class MonnifyService {
  private apiKey: string;
  private secretKey: string;
  private contractCode: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.apiKey = process.env.MONNIFY_API_KEY!;
    this.secretKey = process.env.MONNIFY_SECRET_KEY!;
    this.contractCode = process.env.MONNIFY_CONTRACT_CODE!;
    this.baseUrl = process.env.MONNIFY_BASE_URL || 'https://sandbox.monnify.com';
  }

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (expires in ~1 hour)
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🔑 Getting new Monnify access token...');

    // Create Basic Auth credentials
    const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!result.requestSuccessful) {
      console.error('❌ Monnify auth failed:', result);
      throw new Error(result.responseMessage || 'Authentication failed');
    }

    this.accessToken = result.responseBody.accessToken;
    // Token expires in ~3600 seconds, refresh 5 minutes early
    this.tokenExpiry = Date.now() + (55 * 60 * 1000);

    console.log('✅ Access token obtained');
    return this.accessToken!;
  }

  private async request(endpoint: string, method: string = 'GET', data?: any) {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();

    if (!result.requestSuccessful) {
      console.error('❌ Monnify API error:', result);
      throw new Error(result.responseMessage || 'Request failed');
    }

    return result.responseBody;
  }

  async createReservedAccount(params: CreateReservedAccountParams): Promise<MonnifyVirtualAccount> {
    console.log('🏦 Creating Monnify reserved account...');
    console.log('📧 Email:', params.customerEmail);
    console.log('🆔 Reference:', params.accountReference);

    const requestData = {
      accountReference: params.accountReference,
      accountName: params.accountName,
      currencyCode: params.currencyCode,
      contractCode: params.contractCode,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      getAllAvailableBanks: params.getAllAvailableBanks ?? true,
      preferredBanks: params.preferredBanks || ['50515'], // Moniepoint by default
    };

    const result = await this.request('/api/v2/bank-transfer/reserved-accounts', 'POST', requestData);

    console.log('✅ Reserved account created successfully');
    console.log('🏦 Banks:', result.accounts.map((a: MonnifyAccount) => 
      `${a.bankName}: ${a.accountNumber}`
    ).join(', '));

    return result;
  }

  async getReservedAccountDetails(accountReference: string): Promise<MonnifyVirtualAccount> {
    console.log('🔍 Fetching account details for:', accountReference);
    
    const result = await this.request(
      `/api/v2/bank-transfer/reserved-accounts/${accountReference}`
    );
    
    console.log('✅ Account details retrieved');
    return result;
  }

  async deleteReservedAccount(accountReference: string): Promise<any> {
    console.log('🗑️ Deleting reserved account:', accountReference);
    
    const result = await this.request(
      `/api/v1/bank-transfer/reserved-accounts/reference/${accountReference}`,
      'DELETE'
    );
    
    console.log('✅ Account deleted');
    return result;
  }
}

export const monnifyService = new MonnifyService();