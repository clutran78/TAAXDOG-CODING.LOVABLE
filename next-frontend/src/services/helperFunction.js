


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
        accountName: 'Checking Account'
    });

    transactions.push({
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString(),
        description: 'Dividend Payment',
        amount: '1275.50',
        category: 'Investment',
        merchant: 'Vanguard',
        accountName: 'Investment Account'
    });

    transactions.push({
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString(),
        description: 'Rental Income',
        amount: '2450.00',
        category: 'Real Estate',
        merchant: 'Property Management',
        accountName: 'Checking Account'
    });

    // Add expense transactions
    const categories = [
        'Groceries', 'Dining', 'Entertainment', 'Utilities',
        'Shopping', 'Transportation', 'Housing', 'Healthcare'
    ];

    const merchants = {
        'Groceries': ['Whole Foods', 'Kroger', 'Safeway', 'Trader Joe\'s'],
        'Dining': ['Chipotle', 'Starbucks', 'The Cheesecake Factory', 'Local Coffee'],
        'Entertainment': ['Netflix', 'Spotify', 'AMC Theaters', 'Apple Music'],
        'Utilities': ['Electric Company', 'Water Services', 'Internet Provider', 'Phone Company'],
        'Shopping': ['Amazon', 'Target', 'Walmart', 'Best Buy'],
        'Transportation': ['Uber', 'Shell Gas', 'Chevron', 'Public Transit'],
        'Housing': ['Apartment Rental', 'Home Depot', 'IKEA', 'Property Management'],
        'Healthcare': ['Pharmacy', 'Doctor Visit', 'Dental Clinic', 'Health Insurance']
    };

    // Create expenses for the past specified days
    for (let i = 0; i < days; i++) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);

        // Create 1-2 transactions per day
        const txCount = Math.floor(Math.random() * 2) + 1;

        for (let j = 0; j < txCount; j++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const merchantList = merchants[category];
            const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];

            // Random amount between $5 and $100
            const amount = -1 * (Math.floor(Math.random() * 9500) / 100 + 5).toFixed(2);

            transactions.push({
                id: 'tx-' + Math.random().toString(36).substring(2, 9),
                date: date.toISOString(),
                description: category + ' - ' + merchant,
                amount: amount.toString(),
                category: category,
                merchant: merchant,
                accountName: Math.random() > 0.3 ? 'Checking Account' : 'Credit Card'
            });
        }
    }

    // Add subscription transactions for mock data
    const subscriptions = [
        { name: 'Netflix', amount: 15.99, category: 'Entertainment', merchant: 'Netflix' },
        { name: 'Spotify', amount: 9.99, category: 'Entertainment', merchant: 'Spotify' },
        { name: 'Gym Membership', amount: 49.99, category: 'Health & Fitness', merchant: 'Fitness Center' },
        { name: 'Cloud Storage', amount: 9.99, category: 'Software', merchant: 'Dropbox' }
    ];

    // Add 3 months of subscription history
    for (let i = 0; i < 3; i++) {
        const month = today.getMonth() - i;
        const year = today.getFullYear() + Math.floor(month / 12);
        const adjustedMonth = ((month % 12) + 12) % 12; // Handle negative months

        subscriptions.forEach(sub => {
            // Add each subscription once per month (around the same date)
            const day = 5 + Math.floor(Math.random() * 5); // Between 5th and 10th of month
            const date = new Date(year, adjustedMonth, day);

            // Only add if within our time range
            if ((today - date) / (1000 * 60 * 60 * 24) <= days) {
                transactions.push({
                    id: 'tx-' + Math.random().toString(36).substring(2, 9),
                    date: date.toISOString(),
                    description: sub.name + ' Subscription',
                    amount: (-sub.amount).toString(),
                    category: sub.category,
                    merchant: sub.merchant,
                    accountName: 'Credit Card'
                });
            }
        });
    }

    return transactions;
}


function initializeMockData() {
    // log('Checking if mock data initialization is needed');

    let dataCreated = false;

    try {
        // Check if transactions exist
        let transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');
        let accountsExist = JSON.parse(localStorage.getItem('bankAccounts') || '[]').length > 0;

        // Initialize default transactions if none exist
        if (transactions.length === 0) {
            // log('No transactions found, creating mock transactions');

            // Create sample transactions for the past 30 days
            transactions = generateMockTransactions(30);

            // Save to local storage
            localStorage.setItem('bankTransactions', JSON.stringify(transactions));

            // log('Mock transactions created successfully');
            dataCreated = true;
        }

        // Check if goals exist
        let goals = JSON.parse(localStorage.getItem('financialGoals') || '[]');

        // Initialize default goals if none exist
        if (goals.length === 0) {
            // log('No goals found, creating mock goals');

            // Create sample goals
            const today = new Date();
            const sixMonthsLater = new Date(today);
            sixMonthsLater.setMonth(today.getMonth() + 6);

            const oneYearLater = new Date(today);
            oneYearLater.setMonth(today.getMonth() + 12);

            goals = [
                {
                    id: Date.now(),
                    name: "Emergency Fund",
                    description: "Build a 6-month emergency fund for unexpected expenses",
                    currentAmount: 5000,
                    targetAmount: 10000,
                    dueDate: sixMonthsLater.toISOString().split('T')[0],
                    category: "Emergency Fund",
                    createdAt: today.toISOString(),
                    updatedAt: today.toISOString()
                },
                {
                    id: Date.now() + 1,
                    name: "New Car",
                    description: "Save for a down payment on a new vehicle",
                    currentAmount: 2500,
                    targetAmount: 15000,
                    dueDate: oneYearLater.toISOString().split('T')[0],
                    category: "Car",
                    createdAt: today.toISOString(),
                    updatedAt: today.toISOString()
                },
                {
                    id: Date.now() + 2,
                    name: "Holiday",
                    description: "Save for a summer vacation",
                    currentAmount: 1200,
                    targetAmount: 3000,
                    dueDate: new Date(today.getFullYear(), 8, 15).toISOString().split('T')[0], // September 15
                    category: "Travel",
                    createdAt: today.toISOString(),
                    updatedAt: today.toISOString()
                }
            ];

            // Save to local storage
            localStorage.setItem('financialGoals', JSON.stringify(goals));


            dataCreated = true;
        }

        return dataCreated;
    } catch (error) {
        console.log(`Error initializing mock data: ${error.message}`, 'error');
        return false;
    }
}


function formatCurrency(value) {
    // Make sure we're dealing with a number and not already formatted
    if (typeof value === 'string' && value.startsWith('$')) {
        // Already formatted, just return it
        return value;
    }
    return '$' + parseFloat(value).toFixed(2);
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
        return true;
    }
    return false;
}

  function displayTransactionSummary() {
      try {
        // Get transactions from localStorage
        const transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');

        if (transactions.length === 0) {
          return;
        }

        // Calculate income (positive transactions)
        const income = transactions.reduce((sum, tx) => {
          const amount = parseFloat(tx.amount || '0');
          return sum + (amount > 0 ? amount : 0);
        }, 0);

        // Calculate expenses (negative transactions)
        const expenses = transactions.reduce((sum, tx) => {
          const amount = parseFloat(tx.amount || '0');
          return sum + (amount < 0 ? Math.abs(amount) : 0);
        }, 0);

        // Calculate net balance
        const netBalance = income - expenses;

        // Update UI elements
        updateElementText('net-income-value', formatCurrency(income));
        updateElementText('total-expenses-value', formatCurrency(expenses));
        updateElementText('net-balance-value', formatCurrency(netBalance));

        // Calculate and update subscriptions (simplified estimate)
        const subscriptions = expenses * 0.15; // 15% of expenses as estimation
        updateElementText('subscriptions-value', formatCurrency(subscriptions));

      } catch (error) {
        console.log('errorr', error);

      }
    }




export {
    generateMockTransactions,
    initializeMockData,
    formatCurrency,
    updateElementText,
    displayTransactionSummary
}