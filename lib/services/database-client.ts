/**
 * Database client service to replace Firebase operations
 * Maps Firebase operations to API calls that use PostgreSQL/Prisma
 */

import { apiRequest } from '@/lib/api-request';

// Helper function to get auth headers
const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

/**
 * Replace Firebase auth operations
 */
export const authService = {
  // Sign in with email and password
  async signInWithEmailAndPassword(email: string, password: string) {
    const response = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        csrfToken: await getCsrfToken(),
      }),
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    return response.json();
  },

  // Create user with email and password
  async createUserWithEmailAndPassword(email: string, password: string, additionalData?: any) {
    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: { email, password, ...additionalData },
    });
  },

  // Send password reset email
  async sendPasswordResetEmail(email: string) {
    return apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },

  // Sign out
  async signOut() {
    const { signOut } = await import('next-auth/react');
    return signOut();
  },
};

/**
 * Replace Firestore database operations
 */
export const db = {
  // Generic collection operations
  collection: (collectionName: string) => ({
    // Add document
    async add(data: any) {
      const endpoint = `/api/${collectionName}`;
      return apiRequest(endpoint, {
        method: 'POST',
        body: data,
      });
    },

    // Get documents with optional query
    async get(query?: any) {
      const endpoint = `/api/${collectionName}`;
      const queryString = query ? `?${new URLSearchParams(query).toString()}` : '';
      return apiRequest(`${endpoint}${queryString}`, {
        method: 'GET',
      });
    },

    // Get document by ID
    async doc(id: string) {
      return {
        async get() {
          return apiRequest(`/api/${collectionName}/${id}`, {
            method: 'GET',
          });
        },
        async update(data: any) {
          return apiRequest(`/api/${collectionName}/${id}`, {
            method: 'PUT',
            body: data,
          });
        },
        async delete() {
          return apiRequest(`/api/${collectionName}/${id}`, {
            method: 'DELETE',
          });
        },
      };
    },
  }),

  // Specific collections with typed operations
  goals: {
    async add(goalData: any) {
      return apiRequest('/api/goals', {
        method: 'POST',
        body: goalData,
      });
    },
    async update(id: string, data: any) {
      return apiRequest(`/api/goals/${id}`, {
        method: 'PUT',
        body: data,
      });
    },
    async getByUser(userId: string) {
      return apiRequest(`/api/goals?userId=${userId}`, {
        method: 'GET',
      });
    },
  },

  expenses: {
    async add(expenseData: any) {
      // Map to bank transactions
      return apiRequest('/api/banking/transactions', {
        method: 'POST',
        body: {
          ...expenseData,
          transaction_type: 'expense',
          direction: 'debit',
        },
      });
    },
    async getByUser(userId: string, startDate?: Date, endDate?: Date) {
      const params = new URLSearchParams({
        userId,
        direction: 'debit',
      });
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      return apiRequest(`/api/banking/transactions?${params.toString()}`, {
        method: 'GET',
      });
    },
    async getCategories(userId: string) {
      return apiRequest(`/api/categories/expenses?userId=${userId}`, {
        method: 'GET',
      });
    },
  },

  income: {
    async add(incomeData: any) {
      // Map to bank transactions
      return apiRequest('/api/banking/transactions', {
        method: 'POST',
        body: {
          ...incomeData,
          transaction_type: 'income',
          direction: 'credit',
        },
      });
    },
    async getByUser(userId: string, startDate?: Date, endDate?: Date) {
      const params = new URLSearchParams({
        userId,
        direction: 'credit',
      });
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      return apiRequest(`/api/banking/transactions?${params.toString()}`, {
        method: 'GET',
      });
    },
  },

  users: {
    async create(userData: any) {
      return apiRequest('/api/users', {
        method: 'POST',
        body: userData,
      });
    },
    async update(userId: string, data: any) {
      return apiRequest(`/api/users/${userId}`, {
        method: 'PUT',
        body: data,
      });
    },
    async get(userId: string) {
      return apiRequest(`/api/users/${userId}`, {
        method: 'GET',
      });
    },
  },

  bankAccounts: {
    async add(accountData: any) {
      return apiRequest('/api/banking/accounts', {
        method: 'POST',
        body: accountData,
      });
    },
    async getByUser(userId: string) {
      return apiRequest(`/api/banking/accounts?userId=${userId}`, {
        method: 'GET',
      });
    },
    async delete(accountId: string) {
      return apiRequest(`/api/banking/accounts/${accountId}`, {
        method: 'DELETE',
      });
    },
  },
};

/**
 * Replace Firebase storage operations
 */
export const storage = {
  async uploadFile(file: File, path: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  },

  async deleteFile(url: string) {
    return apiRequest('/api/upload', {
      method: 'DELETE',
      body: { url },
    });
  },
};

// Helper to get CSRF token
async function getCsrfToken() {
  const response = await fetch('/api/auth/csrf');
  const data = await response.json();
  return data.csrfToken;
}

// Re-export common Firebase-like functions
export { authService as auth };

// Helper to check authentication status
export function onAuthStateChanged(callback: (user: any) => void) {
  // Use NextAuth session
  import('next-auth/react').then(({ useSession }) => {
    // This is a simplified version - in components, use useSession hook directly
    callback(null);
  });
}
