import { 
  Subaccount, 
  SubaccountResponse, 
  SubaccountListResponse,
  SubaccountCreationRequest,
  SubaccountTransferRequest,
  SubaccountTransaction,
  SubaccountTransactionResponse,
  SubaccountTransactionListResponse,
  SubaccountSummary,
  SubaccountAnalytics,
  GrowthProjection
} from '@/lib/types/subaccount';

// Base API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Service class for managing subaccounts and their transactions
 * Handles all frontend-to-backend communication for subaccount functionality
 */
class SubaccountService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = `${API_BASE_URL}/api/subaccounts`;
  }

  /**
   * Get authentication headers for API requests
   */
  private async getHeaders(): Promise<HeadersInit> {
    // TODO: Integrate with your authentication system
    // For now, using basic headers - update based on your auth implementation
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  /**
   * Handle API response and error processing
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // ==================== SUBACCOUNT CRUD OPERATIONS ====================

  /**
   * Create a new subaccount for a goal
   */
  async createSubaccount(request: SubaccountCreationRequest): Promise<SubaccountResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(request)
      });

      const result = await this.handleResponse<SubaccountResponse>(response);
      console.log('✅ Created subaccount:', result.data?.id);
      return result;
    } catch (error) {
      console.error('❌ Failed to create subaccount:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get subaccount by ID
   */
  async getSubaccount(subaccountId: string): Promise<SubaccountResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/${subaccountId}`, {
        method: 'GET',
        headers: await this.getHeaders()
      });

      return await this.handleResponse<SubaccountResponse>(response);
    } catch (error) {
      console.error(`❌ Failed to get subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get subaccount for a specific goal
   */
  async getSubaccountByGoalId(goalId: string): Promise<SubaccountResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/goal/${goalId}`, {
        method: 'GET',
        headers: await this.getHeaders()
      });

      return await this.handleResponse<SubaccountResponse>(response);
    } catch (error) {
      console.error(`❌ Failed to get subaccount for goal ${goalId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all subaccounts for a user
   */
  async getUserSubaccounts(userId?: string): Promise<SubaccountListResponse> {
    try {
      const url = userId ? `${this.apiUrl}/user/${userId}` : `${this.apiUrl}/user`;
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getHeaders()
      });

      return await this.handleResponse<SubaccountListResponse>(response);
    } catch (error) {
      console.error('❌ Failed to get user subaccounts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update subaccount settings
   */
  async updateSubaccount(subaccountId: string, updates: Partial<Subaccount>): Promise<SubaccountResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/${subaccountId}`, {
        method: 'PUT',
        headers: await this.getHeaders(),
        body: JSON.stringify(updates)
      });

      const result = await this.handleResponse<SubaccountResponse>(response);
      console.log('✅ Updated subaccount:', subaccountId);
      return result;
    } catch (error) {
      console.error(`❌ Failed to update subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete/close a subaccount
   */
  async deleteSubaccount(subaccountId: string, reason?: string): Promise<SubaccountResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/${subaccountId}`, {
        method: 'DELETE',
        headers: await this.getHeaders(),
        body: JSON.stringify({ reason })
      });

      const result = await this.handleResponse<SubaccountResponse>(response);
      console.log('✅ Deleted subaccount:', subaccountId);
      return result;
    } catch (error) {
      console.error(`❌ Failed to delete subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== TRANSACTION OPERATIONS ====================

  /**
   * Process a manual transfer (deposit/withdrawal)
   */
  async processTransfer(request: SubaccountTransferRequest): Promise<SubaccountTransactionResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/${request.subaccountId}/transfer`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(request)
      });

      const result = await this.handleResponse<SubaccountTransactionResponse>(response);
      console.log('✅ Processed transfer:', result.data?.id);
      return result;
    } catch (error) {
      console.error('❌ Failed to process transfer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transaction history for a subaccount
   */
  async getSubaccountTransactions(
    subaccountId: string, 
    options?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      type?: string;
    }
  ): Promise<SubaccountTransactionListResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.startDate) params.append('startDate', options.startDate);
      if (options?.endDate) params.append('endDate', options.endDate);
      if (options?.type) params.append('type', options.type);

      const url = `${this.apiUrl}/${subaccountId}/transactions${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getHeaders()
      });

      return await this.handleResponse<SubaccountTransactionListResponse>(response);
    } catch (error) {
      console.error(`❌ Failed to get transactions for subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== BALANCE AND SYNC OPERATIONS ====================

  /**
   * Sync subaccount balance with bank
   */
  async syncSubaccountBalance(subaccountId: string): Promise<SubaccountResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/${subaccountId}/sync`, {
        method: 'POST',
        headers: await this.getHeaders()
      });

      const result = await this.handleResponse<SubaccountResponse>(response);
      console.log('✅ Synced subaccount balance:', subaccountId);
      return result;
    } catch (error) {
      console.error(`❌ Failed to sync balance for subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get quick summary for goal card display
   */
  async getSubaccountSummary(subaccountId: string): Promise<{ success: boolean; data?: SubaccountSummary; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/${subaccountId}/summary`, {
        method: 'GET',
        headers: await this.getHeaders()
      });

      return await this.handleResponse<{ success: boolean; data?: SubaccountSummary; error?: string }>(response);
    } catch (error) {
      console.error(`❌ Failed to get summary for subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== ANALYTICS AND PROJECTIONS ====================

  /**
   * Get analytics for a subaccount
   */
  async getSubaccountAnalytics(
    subaccountId: string, 
    period: { startDate: string; endDate: string }
  ): Promise<{ success: boolean; data?: SubaccountAnalytics; error?: string }> {
    try {
      const params = new URLSearchParams({
        startDate: period.startDate,
        endDate: period.endDate
      });

      const response = await fetch(`${this.apiUrl}/${subaccountId}/analytics?${params.toString()}`, {
        method: 'GET',
        headers: await this.getHeaders()
      });

      return await this.handleResponse<{ success: boolean; data?: SubaccountAnalytics; error?: string }>(response);
    } catch (error) {
      console.error(`❌ Failed to get analytics for subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate growth projections based on current transfer patterns
   */
  async calculateGrowthProjections(
    subaccountId: string,
    scenarios?: {
      transferAmount?: number;
      frequency?: string;
      interestRate?: number;
      timeframe?: string;
    }
  ): Promise<{ success: boolean; data?: GrowthProjection[]; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/${subaccountId}/projections`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(scenarios || {})
      });

      return await this.handleResponse<{ success: boolean; data?: GrowthProjection[]; error?: string }>(response);
    } catch (error) {
      console.error(`❌ Failed to calculate projections for subaccount ${subaccountId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if bank supports real subaccounts
   */
  async checkBankSubaccountSupport(institutionId: string): Promise<{ supported: boolean; features: string[] }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banks/${institutionId}/subaccount-support`, {
        method: 'GET',
        headers: await this.getHeaders()
      });

      return await this.handleResponse<{ supported: boolean; features: string[] }>(response);
    } catch (error) {
      console.error(`❌ Failed to check subaccount support for institution ${institutionId}:`, error);
      return { supported: false, features: [] };
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number, currency: string = 'AUD'): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Calculate interest earned over a period
   */
  calculateInterest(
    principal: number, 
    rate: number, 
    time: number, 
    compounding: 'daily' | 'monthly' | 'quarterly' | 'annually' = 'monthly'
  ): number {
    const compoundingPeriods = {
      daily: 365,
      monthly: 12,
      quarterly: 4,
      annually: 1
    };

    const n = compoundingPeriods[compounding];
    const decimalRate = rate / 100;
    const timeInYears = time / 365; // Assuming time is in days

    return principal * Math.pow(1 + decimalRate / n, n * timeInYears) - principal;
  }

  /**
   * Get the effective balance for goal progress calculation
   */
  getEffectiveBalance(subaccount: Subaccount): number {
    // Use available balance (excluding pending/held funds)
    return subaccount.balance.available;
  }
}

// Export singleton instance
export const subaccountService = new SubaccountService();
export default subaccountService; 