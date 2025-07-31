interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

class ApiService {
  private baseUrl = '/api'

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'An error occurred',
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      }
    }
  }

  // Dashboard API calls
  async getDashboardData(userId: string) {
    return this.request(`/dashboard?userId=${userId}`)
  }

  // Banking API calls
  async getBankAccounts(userId: string) {
    return this.request(`/banking/accounts?userId=${userId}`)
  }

  async connectBank(userId: string, bankData: any) {
    return this.request('/banking/connect', {
      method: 'POST',
      body: JSON.stringify({ userId, ...bankData }),
    })
  }

  async getTransactions(userId: string, accountId?: string) {
    const params = new URLSearchParams({ userId })
    if (accountId) params.append('accountId', accountId)
    return this.request(`/banking/transactions?${params}`)
  }

  // Goals API calls
  async getGoals(userId: string) {
    return this.request(`/goals?userId=${userId}`)
  }

  async createGoal(userId: string, goalData: any) {
    return this.request('/goals', {
      method: 'POST',
      body: JSON.stringify({ userId, ...goalData }),
    })
  }

  async updateGoal(goalId: string, goalData: any) {
    return this.request(`/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(goalData),
    })
  }

  async deleteGoal(goalId: string) {
    return this.request(`/goals/${goalId}`, {
      method: 'DELETE',
    })
  }

  // Financial data API calls
  async getNetIncome(userId: string, period?: string) {
    const params = new URLSearchParams({ userId })
    if (period) params.append('period', period)
    return this.request(`/financial/net-income?${params}`)
  }

  async getTotalExpenses(userId: string, period?: string) {
    const params = new URLSearchParams({ userId })
    if (period) params.append('period', period)
    return this.request(`/financial/total-expenses?${params}`)
  }

  async getNetBalance(userId: string) {
    return this.request(`/financial/net-balance?userId=${userId}`)
  }

  // User API calls
  async getUserProfile(userId: string) {
    return this.request(`/user/profile?userId=${userId}`)
  }

  async updateUserProfile(userId: string, profileData: any) {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ userId, ...profileData }),
    })
  }

  // Tax profile API calls
  async getTaxProfile(userId: string) {
    return this.request(`/tax/profile?userId=${userId}`)
  }

  async updateTaxProfile(userId: string, taxData: any) {
    return this.request('/tax/profile', {
      method: 'PUT',
      body: JSON.stringify({ userId, ...taxData }),
    })
  }

  // Receipt API calls
  async uploadReceipt(userId: string, receiptData: FormData) {
    return this.request('/receipts/upload', {
      method: 'POST',
      headers: {}, // Remove Content-Type for FormData
      body: receiptData,
    })
  }

  async getReceipts(userId: string) {
    return this.request(`/receipts?userId=${userId}`)
  }
}

export const apiService = new ApiService()