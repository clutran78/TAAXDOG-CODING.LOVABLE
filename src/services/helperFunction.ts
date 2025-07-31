import Chart from '@/components/utils/chartSetup';

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
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    // Generate 0-3 transactions per day
    const transactionsPerDay = Math.floor(Math.random() * 4);

    for (let j = 0; j < transactionsPerDay; j++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const merchantList = merchants[category];
      const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];

      // Generate random amount based on category
      let amount;
      switch (category) {
        case 'Groceries':
          amount = (50 + Math.random() * 150).toFixed(2);
          break;
        case 'Dining':
          amount = (15 + Math.random() * 60).toFixed(2);
          break;
        case 'Entertainment':
          amount = (10 + Math.random() * 50).toFixed(2);
          break;
        case 'Utilities':
          amount = (50 + Math.random() * 200).toFixed(2);
          break;
        case 'Shopping':
          amount = (30 + Math.random() * 200).toFixed(2);
          break;
        case 'Transportation':
          amount = (20 + Math.random() * 80).toFixed(2);
          break;
        case 'Housing':
          amount = (100 + Math.random() * 300).toFixed(2);
          break;
        case 'Healthcare':
          amount = (30 + Math.random() * 150).toFixed(2);
          break;
        default:
          amount = (20 + Math.random() * 100).toFixed(2);
      }

      transactions.push({
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        date: date.toISOString(),
        description: `${merchant} Purchase`,
        amount: `-${amount}`, // Negative for expenses
        category: category,
        merchant: merchant,
        accountName: 'Checking Account',
      });
    }
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Format currency with proper formatting
export function formatCurrency(value) {
  // Ensure it's a number
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '$0.00';

  return (
    '$' +
    num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Load income details (placeholder function)
export async function loadIncomeDetails() {
  try {
    // This would typically fetch from API
    console.log('Loading income details...');

    // Mock implementation
    const incomeData = {
      totalIncome: 9575.5,
      sources: [
        { source: 'Salary', amount: 5850.0 },
        { source: 'Investments', amount: 1275.5 },
        { source: 'Rental', amount: 2450.0 },
      ],
      monthlyAverage: 9575.5,
      yearToDate: 57453.0,
    };

    return incomeData;
  } catch (error) {
    console.error('Error loading income details:', error);
    return null;
  }
}

// Setup financial feature handlers (placeholder)
export function setupFinancialFeatureHandlers() {
  try {
    // This would typically set up event handlers
    console.log('Setting up financial feature handlers...');

    // Mock implementation
    return true;
  } catch (error) {
    console.error('Error setting up handlers:', error);
    return false;
  }
}

// Update bank connections display (placeholder)
export function updateBankConnectionsDisplay() {
  try {
    // This would typically update UI elements
    console.log('Updating bank connections display...');

    // Mock implementation
    return true;
  } catch (error) {
    console.error('Error updating display:', error);
    return false;
  }
}

// Initialize chart with data
export function initializeChart(chartId, chartData, options = {}) {
  try {
    const canvas = document.getElementById(chartId) as HTMLCanvasElement;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return new Chart(ctx, {
      type: options.type || 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options,
      },
    });
  } catch (error) {
    console.error('Error initializing chart:', error);
    return null;
  }
}

// Calculate percentage change
export function calculatePercentageChange(current, previous) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Format date for display
export function formatDate(date, format = 'short') {
  const d = new Date(date);

  if (format === 'short') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } else if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return d.toLocaleDateString();
}

// Generate chart data for expenses
export function generateExpenseChartData(transactions) {
  const categoryTotals = {};

  transactions.forEach((tx) => {
    const amount = parseFloat(tx.amount);
    if (amount < 0) {
      // Only expenses
      const category = tx.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(amount);
    }
  });

  return {
    labels: Object.keys(categoryTotals),
    datasets: [
      {
        data: Object.values(categoryTotals),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF',
        ],
      },
    ],
  };
}

// Generate chart data for income vs expenses
export function generateIncomeVsExpenseData(transactions) {
  const monthlyData = {};

  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }

    const amount = parseFloat(tx.amount);
    if (amount > 0) {
      monthlyData[monthKey].income += amount;
    } else {
      monthlyData[monthKey].expenses += Math.abs(amount);
    }
  });

  const sortedMonths = Object.keys(monthlyData).sort();

  return {
    labels: sortedMonths.map((month) => {
      const [year, monthNum] = month.split('-');
      return new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    }),
    datasets: [
      {
        label: 'Income',
        data: sortedMonths.map((month) => monthlyData[month].income),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Expenses',
        data: sortedMonths.map((month) => monthlyData[month].expenses),
        borderColor: '#f44336',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        tension: 0.4,
      },
    ],
  };
}

// Open expense categories modal
export function openExpenseCategoriesModal() {
  try {
    const modal = document.getElementById('totalExpensesModal');
    if (modal) {
      // Bootstrap modal initialization
      const event = new Event('show.bs.modal');
      modal.dispatchEvent(event);
    }
  } catch (error) {
    console.error('Error opening expense categories modal:', error);
  }
}

// Perform expense search
export function performExpenseSearch(expenses, searchTerm) {
  if (!searchTerm) return expenses;

  const term = searchTerm.toLowerCase();
  return expenses.filter(
    (expense) =>
      expense.description?.toLowerCase().includes(term) ||
      expense.merchant?.toLowerCase().includes(term) ||
      expense.category?.toLowerCase().includes(term) ||
      expense.accountName?.toLowerCase().includes(term),
  );
}

// Show toast notification
export function showToast(message, type = 'info') {
  try {
    // This would typically use a toast library
    console.log(`[${type.toUpperCase()}] ${message}`);

    // You can integrate with react-hot-toast or similar library here
    // For now, using browser's console
    if (type === 'error') {
      console.error(message);
    } else if (type === 'warning') {
      console.warn(message);
    } else {
      console.log(message);
    }
  } catch (error) {
    console.error('Error showing toast:', error);
  }
}

export { generateMockTransactions };
