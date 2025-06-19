const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const insightsAPI = {
  getComprehensiveInsights: async ( ) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/insights/comprehensive`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },
  
  getSpendingInsights: async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/insights/spending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },
  
  getTaxOptimization: async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/insights/tax-optimization`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  }
}; 