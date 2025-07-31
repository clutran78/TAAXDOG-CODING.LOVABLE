import Chart from '@/components/utils/chartSetup';
import { getData, postData, putData, deleteData } from '@/services/api/apiController';
import { getSession } from 'next-auth/react';

// Generate mock transactions
function generateMockTransactions(days = 30) {
  const today = new Date();
  const transactions = [];

  // Add income transactions
  transactions.push({
    id: 'tx-' + Math.random().toString(36).substring(2, 9),
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString(),
    description: 'Monthly Salary',
    amount: '5850.00',
    category: 'Income',
    merchant: 'Employer Inc',
    accountName: 'Checking Account',
  });

  transactions.push({
    id: 'tx-' + Math.random().toString(36).substring(2, 9),
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString(),
    description: 'Dividend Payment',
    amount: '1275.50',
    category: 'Investment',
    merchant: 'Vanguard',
    accountName: 'Investment Account',
  });

  transactions.push({
    id: 'tx-' + Math.random().toString(36).substring(2, 9),
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString(),
    description: 'Rental Income',
    amount: '2450.00',
    category: 'Real Estate',
    merchant: 'Property Management',
    accountName: 'Checking Account',
  });

  // Add expense transactions
  const categories = [
    'Groceries',
    'Dining',
    'Entertainment',
    'Utilities',
    'Shopping',
    'Transportation',
    'Housing',
    'Healthcare',
  ];

  const merchants = {
    Groceries: ['Whole Foods', 'Kroger', 'Safeway', "Trader Joe's"],
    Dining: ['Chipotle', 'Starbucks', 'The Cheesecake Factory', 'Local Coffee'],
    Entertainment: ['Netflix', 'Spotify', 'AMC Theaters', 'Apple Music'],
    Utilities: ['Electric Company', 'Water Services', 'Internet Provider', 'Phone Company'],
    Shopping: ['Amazon', 'Target', 'Walmart', 'Best Buy'],
    Transportation: ['Uber', 'Shell Gas', 'Chevron', 'Public Transit'],
    Housing: ['Apartment Rental', 'Home Depot', 'IKEA', 'Property Management'],
    Healthcare: ['Pharmacy', 'Doctor Visit', 'Dental Clinic', 'Health Insurance'],
  };

  // Create expenses for the past specified days
  for (let i = 0; i < days; i++) {
    // Generate 0-3 transactions per day
    const transactionsPerDay = Math.floor(Math.random() * 4);

    for (let j = 0; j < transactionsPerDay; j++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const merchantList = merchants[category];
      const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];

      // Generate random expense amount based on category
      let amount;
      switch (category) {
        case 'Groceries':
          amount = (Math.random() * 200 + 50).toFixed(2);
          break;
        case 'Dining':
          amount = (Math.random() * 80 + 15).toFixed(2);
          break;
        case 'Entertainment':
          amount = (Math.random() * 50 + 10).toFixed(2);
          break;
        case 'Utilities':
          amount = (Math.random() * 150 + 50).toFixed(2);
          break;
        case 'Shopping':
          amount = (Math.random() * 300 + 20).toFixed(2);
          break;
        case 'Transportation':
          amount = (Math.random() * 100 + 10).toFixed(2);
          break;
        case 'Housing':
          amount = (Math.random() * 100 + 50).toFixed(2);
          break;
        case 'Healthcare':
          amount = (Math.random() * 200 + 30).toFixed(2);
          break;
        default:
          amount = (Math.random() * 100 + 10).toFixed(2);
      }

      transactions.push({
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - i).toISOString(),
        description: `${merchant} Purchase`,
        amount: `-${amount}`,
        category: category,
        merchant: merchant,
        accountName: 'Credit Card',
      });
    }
  }

  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Format currency
export function formatCurrency(amount) {
  // Handle various input types
  if (amount === null || amount === undefined || amount === '') return '$0.00';

  // Convert to number
  let numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Check for NaN
  if (isNaN(numAmount)) return '$0.00';

  // Format with 2 decimal places and comma separators
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(numAmount));
}

// Update text content of an element
function updateElementText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    // Special case for total-subscriptions-value to prevent double $ signs
    if (elementId === 'total-subscriptions-value' && text.startsWith('$')) {
      // Strip the $ for the subscription value since the HTML already has a $ prefix
      element.textContent = text.substring(1);
    } else {
      element.textContent = text;
    }
  }
}

// Calculate net balance
export async function calculateNetBalance() {
  try {
    const session = await getSession();
    if (!session?.user) {
      console.error('No authenticated user found');
      return 0;
    }

    // Fetch transactions from API
    const response = await getData('/api/banking/transactions');
    const transactions = response.data || [];

    if (transactions.length === 0) {
      return 0;
    }

    // Calculate totals
    const totalIncome = transactions
      .filter((t) => parseFloat(t.amount) > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalExpenses = transactions
      .filter((t) => parseFloat(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    return totalIncome - totalExpenses;
  } catch (error) {
    console.error('Error calculating net balance:', error);
    return 0;
  }
}

// Load income details
export async function loadIncomeDetails() {
  if (typeof document === 'undefined') return;

  try {
    const session = await getSession();
    if (!session?.user) {
      console.error('No authenticated user found');
      return;
    }

    // Fetch transactions from API
    const response = await getData('/api/banking/transactions');
    const transactions = response.data || [];

    if (transactions.length === 0) {
      return;
    }

    // Filter income transactions
    const incomeTransactions = transactions.filter((t) => parseFloat(t.amount) > 0);

    // Calculate total income
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Update UI elements
    const incomeValueElement = document.getElementById('modal-income-value');
    if (incomeValueElement) {
      incomeValueElement.textContent = formatCurrency(totalIncome);
    }

    // Group by source
    const incomeBySource = {};
    incomeTransactions.forEach((t) => {
      const source = t.category || 'Other';
      if (!incomeBySource[source]) {
        incomeBySource[source] = 0;
      }
      incomeBySource[source] += parseFloat(t.amount);
    });

    // Update income sources UI
    const sourcesContainer = document.getElementById('income-sources-container');
    const noSourcesMessage = document.getElementById('no-income-sources');

    if (sourcesContainer) {
      sourcesContainer.innerHTML = '';

      if (Object.keys(incomeBySource).length === 0) {
        if (noSourcesMessage) {
          noSourcesMessage.style.display = 'block';
        }
      } else {
        if (noSourcesMessage) {
          noSourcesMessage.style.display = 'none';
        }

        Object.entries(incomeBySource)
          .sort((a, b) => b[1] - a[1])
          .forEach(([source, amount]) => {
            const sourceElement = document.createElement('div');
            sourceElement.className = 'flex justify-between items-center py-2 border-b';
            sourceElement.innerHTML = `
              <span class="text-gray-600">${source}</span>
              <span class="font-medium">${formatCurrency(amount)}</span>
            `;
            sourcesContainer.appendChild(sourceElement);
          });
      }
    }
  } catch (error) {
    console.error('Error loading income details:', error);
  }
}

// Load expense categories
export async function loadExpenseCategories() {
  if (typeof document === 'undefined') return;

  try {
    const session = await getSession();
    if (!session?.user) {
      console.error('No authenticated user found');
      return;
    }

    // Fetch transactions from API
    const response = await getData('/api/banking/transactions');
    const transactions = response.data || [];

    if (transactions.length === 0) {
      return;
    }

    // Filter expense transactions
    const expenseTransactions = transactions.filter((t) => parseFloat(t.amount) < 0);

    // Group by category
    const expensesByCategory = {};
    expenseTransactions.forEach((t) => {
      const category = t.category || 'Other';
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = 0;
      }
      expensesByCategory[category] += Math.abs(parseFloat(t.amount));
    });

    // Update UI
    updateExpenseCategoriesUI(expensesByCategory);
  } catch (error) {
    console.error('Error loading expense categories:', error);
  }
}

// Update expense categories UI
function updateExpenseCategoriesUI(expensesByCategory) {
  const container = document.getElementById('expense-categories-container');
  if (!container) return;

  container.innerHTML = '';

  Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, amount]) => {
      const categoryElement = document.createElement('div');
      categoryElement.className = 'expense-category-item';
      categoryElement.innerHTML = `
        <div class="flex justify-between items-center py-3 px-4 hover:bg-gray-50 rounded">
          <span class="text-gray-700">${category}</span>
          <span class="font-semibold text-gray-900">${formatCurrency(amount)}</span>
        </div>
      `;
      container.appendChild(categoryElement);
    });
}

// Setup financial feature handlers
export function setupFinancialFeatureHandlers() {
  if (typeof document === 'undefined') return;

  // Setup search functionality
  const searchInput = document.getElementById('expense-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const categoryItems = document.querySelectorAll('.expense-category-item');

      categoryItems.forEach((item) => {
        const categoryName = item.textContent.toLowerCase();
        if (categoryName.includes(searchTerm)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Setup other event handlers as needed
}

// Update bank connections display
export async function updateBankConnectionsDisplay() {
  if (typeof document === 'undefined') return;

  try {
    const session = await getSession();
    if (!session?.user) {
      console.error('No authenticated user found');
      return;
    }

    // Fetch bank accounts from API
    const response = await getData('/api/banking/accounts');
    const accounts = response.data || [];

    // Update UI with accounts information
    const container = document.getElementById('bank-connections-container');
    if (container) {
      if (accounts.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No bank accounts connected</p>';
      } else {
        container.innerHTML = accounts
          .map(
            (account) => `
          <div class="bank-account-item p-3 border rounded mb-2">
            <div class="flex justify-between items-center">
              <span class="font-medium">${account.name || 'Bank Account'}</span>
              <span class="text-green-600">${formatCurrency(account.balance || 0)}</span>
            </div>
          </div>
        `,
          )
          .join('');
      }
    }
  } catch (error) {
    console.error('Error updating bank connections display:', error);
  }
}

// Create financial charts
export function createFinancialCharts() {
  if (typeof document === 'undefined') return;

  // Income vs Expenses Chart
  const incomeExpensesCtx = document.getElementById('income-expenses-chart');
  if (incomeExpensesCtx) {
    new Chart(incomeExpensesCtx, {
      type: 'bar',
      data: {
        labels: ['Income', 'Expenses'],
        datasets: [
          {
            data: [0, 0], // Will be updated with real data
            backgroundColor: ['#10b981', '#ef4444'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }

  // Monthly Trend Chart
  const monthlyTrendCtx = document.getElementById('monthly-trend-chart');
  if (monthlyTrendCtx) {
    new Chart(monthlyTrendCtx, {
      type: 'line',
      data: {
        labels: [], // Will be populated with month names
        datasets: [
          {
            label: 'Net Balance',
            data: [], // Will be populated with monthly data
            borderColor: '#3b82f6',
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }
}

// Setup bank connection handlers (placeholder for now)
export function setupBankConnectionHandlers() {
  // This function would handle bank connection UI interactions
  // For now, it's a placeholder as the actual bank connection
  // is handled through the banking API endpoints
  console.log('Bank connection handlers initialized');
}

// Open detailed expenses modal (placeholder)
export function openDetailedExpensesModal() {
  // This would typically trigger a modal to show detailed expenses
  // The actual implementation depends on the modal system being used
  console.log('Opening detailed expenses modal');
}

// Show toast notification
export const showToast = (message, type = 'primary') => {
  // This is a placeholder for toast notifications
  // In production, this would integrate with a toast library
  console.log(`Toast [${type}]: ${message}`);

  // If using react-hot-toast (which is installed in the project)
  if (typeof window !== 'undefined') {
    import('react-hot-toast').then(({ default: toast }) => {
      switch (type) {
        case 'success':
          toast.success(message);
          break;
        case 'error':
          toast.error(message);
          break;
        default:
          toast(message);
      }
    });
  }
};

// Export all functions that components might use
export { generateMockTransactions, updateElementText, updateExpenseCategoriesUI };
