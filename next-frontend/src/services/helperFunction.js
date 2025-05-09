
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

// Load income details
function loadIncomeDetails() {
    debugger
    try {
        // Get transactions from localStorage
        const transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');
        const incomeTransactions = transactions.filter(tx => parseFloat(tx.amount) > 0);

        // Update total income value in modal
        const totalIncome = incomeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
        const incomeValueElement = document.getElementById('modal-net-income-value');
        if (incomeValueElement) {
            incomeValueElement.textContent = formatCurrency(totalIncome);
        }

        // Group income by source/category
        const incomeBySource = {};
        incomeTransactions.forEach(tx => {
            const source = tx.category || 'Other Income';
            if (!incomeBySource[source]) {
                incomeBySource[source] = 0;
            }
            incomeBySource[source] += parseFloat(tx.amount);
        });

        // Generate HTML for income sources
        const sourcesContainer = document.getElementById('income-sources-container');
        const noSourcesMessage = document.getElementById('no-income-sources-message');

        if (sourcesContainer) {
            if (incomeTransactions.length === 0) {
                if (noSourcesMessage) noSourcesMessage.style.display = 'block';
                sourcesContainer.innerHTML = '';
                return;
            }
            debugger

            if (noSourcesMessage) noSourcesMessage.style.display = 'none';

            let sourcesHTML = '';
            Object.entries(incomeBySource).forEach(([source, amount]) => {
                const percentage = ((amount / totalIncome) * 100).toFixed(1);

                sourcesHTML += `
                        <div class="card mb-3">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h5 class="mb-0">${source}</h5>
                                    <span class="badge bg-success">${percentage}%</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mt-2">
                                    <div class="text-muted">Monthly income</div>
                                    <h4 class="text-success mb-0">${formatCurrency(amount)}</h4>
                                </div>
                                <div class="progress mt-3" style="height: 5px;">
                                    <div class="progress-bar bg-success" role="progressbar" style="width: ${percentage}%" 
                                        aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                            </div>
                        </div>
                    `;
            });
debugger
            sourcesContainer.innerHTML = sourcesHTML;
        }

    } catch (error) {
        console.log(`Error loading income details: ${error.message}`, 'error');
    }
}

function setupExpenseSearch() {
    try {
        const searchInput = document.getElementById('expense-search');
        const searchButton = document.getElementById('expense-search-btn');

        if (!searchInput || !searchButton) {
            return;
        }

        // Clear any existing event listeners
        const newSearchInput = searchInput.cloneNode(true);
        const newSearchButton = searchButton.cloneNode(true);

        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        searchButton.parentNode.replaceChild(newSearchButton, searchButton);

        // Add search functionality
        newSearchButton.addEventListener('click', performExpenseSearch);
        newSearchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                performExpenseSearch();
            }
        });

    } catch (error) {
        console.log(`Error setting up expense search: ${error.message}`, 'error');
    }
}


// Open expense categories modal
export async function openExpenseCategoriesModal() {
    debugger

    if (typeof document === 'undefined') return; // Guard against SSR
  
    // Dynamically import Modal only on the client
    const { default: Modal } = await import('bootstrap/js/dist/modal');
  
    let modalElement = document.getElementById('expense-categories-modal');
  
    if (!modalElement) {
      modalElement = document.createElement('div');
      modalElement.id = 'expense-categories-modal';
      modalElement.className = 'modal fade';
      modalElement.setAttribute('tabindex', '-1');
      modalElement.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-chart-pie text-danger me-2"></i>Expense Categories
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="text-center p-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading expense data...</p>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>

          </div>
        </div>
      `;
      document.body.appendChild(modalElement);
    }
  
    const modal = new Modal(modalElement);
    modal.show();
  
    modalElement.addEventListener(
      'shown.bs.modal',
      () => loadExpenseCategoriesContent(modalElement),
      { once: true }
    );
  }
  

// Load detailed expenses
function loadDetailedExpenses() {
debugger
    try {
        // Get transactions from localStorage
        const transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');
        const expenses = transactions.filter(tx => parseFloat(tx.amount) < 0);

        // Update total expenses value in modal
        const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);

        const expensesValueElement = document.getElementById('modal-detailed-expenses-value');
        
        if (expensesValueElement) {
            expensesValueElement.textContent = formatCurrency(totalExpenses);
        }

        // Display expenses in table
        const tableBody = document.getElementById('expenses-table-body');
        const noExpensesMessage = document.getElementById('no-expenses-message');

        if (tableBody) {
            if (expenses.length === 0) {
                tableBody.innerHTML = '';
                if (noExpensesMessage) noExpensesMessage.classList.remove('d-none');
                return;
            }

            if (noExpensesMessage) noExpensesMessage.classList.add('d-none');

            // Sort expenses by date (newest first)
            expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

            let tableRows = '';
            expenses.forEach(expense => {
                const amount = Math.abs(parseFloat(expense.amount)).toFixed(2);
                const date = new Date(expense.date).toLocaleDateString();

                tableRows += `
                    <tr>
                        <td>${date}</td>
                        <td>${expense.description || 'No description'}</td>
                        <td>${expense.merchant || 'Unknown'}</td>
                        <td><span class="badge bg-primary">${expense.category || 'Uncategorized'}</span></td>
                        <td>${expense.accountName || 'Unknown Account'}</td>
                        <td class="text-end text-danger">$${amount}</td>
                    </tr>
                `;
            });

            tableBody.innerHTML = tableRows;
        }

    } catch (error) {
        console.log(`Error loading detailed expenses: ${error.message}`, 'error');
    }
}

function loadExpenseCategoriesContent(modalElement) {

    try {
        // Get transactions
        const transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');
        const expenses = transactions.filter(tx => parseFloat(tx.amount) < 0);

        if (expenses.length === 0) {
            modalElement.querySelector('.modal-body').innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-circle fa-3x text-warning mb-3"></i>
                    <p>No expense transactions found. Connect your bank account or create mock data first.</p>
                </div>
            `;
            return;
        }

        // Calculate total expenses
        const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);

        // Group by category
        const categories = {};
        expenses.forEach(tx => {
            const category = tx.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = 0;
            }
            categories[category] += Math.abs(parseFloat(tx.amount));
        });

        // Sort categories by amount
        const sortedCategories = Object.entries(categories)
            .sort((a, b) => b[1] - a[1]);

        // Generate HTML content
        let categoriesHTML = '';
        sortedCategories.forEach(([category, amount]) => {
            const percentage = ((amount / totalExpenses) * 100).toFixed(1);
            categoriesHTML += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                    <div>
                        <span class="badge bg-primary me-2">${category}</span>
                        <span>${percentage}%</span>
                    </div>
                    <span class="text-danger fw-bold">$${amount.toFixed(2)}</span>
                </div>
            `;
        });

        // Update modal content
        modalElement.querySelector('.modal-body').innerHTML = `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card bg-light">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <h4 class="mb-0">Total Expenses</h4>
                                <h3 class="text-danger mb-0">$${totalExpenses.toFixed(2)}</h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-7">
                    <h5 class="mb-3">Expenses by Category</h5>
                    <div class="card">
                        <div class="card-body p-3">
                            ${categoriesHTML}
                        </div>
                    </div>
                </div>
                <div class="col-md-5">
                    <h5 class="mb-3">Distribution</h5>
                    <div class="card">
                        <div class="card-body">
                            <div class="text-center py-3">
                                <i class="fas fa-chart-pie fa-3x text-primary mb-3"></i>
                                <p>Chart visualization would appear here</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        if (modalElement) {
            modalElement.querySelector('.modal-body').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    An error occurred while loading expense data. Please try again.
                </div>
            `;
        }
    }
}


// Open net balance modal
async function openNetBalanceModal() {
    debugger
    const { default: Modal } = await import('bootstrap/js/dist/modal');

    try {
        // Get modal element
        let modalElement = document.getElementById('net-balance-modal');

        // Show the modal
        const modal = new Modal(modalElement);
        modal.show();

        // Load balance data
        loadNetBalanceDetails();

    } catch (error) {
        alert('An error occurred while opening the net balance details. Please refresh the page.', 'danger');
    }
}

// Load net balance details
function loadNetBalanceDetails() {

    try {
        // Get transactions from localStorage
        const transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');

        // Calculate income (positive transactions)
        const incomeTransactions = transactions.filter(tx => parseFloat(tx.amount) > 0);
        const totalIncome = incomeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

        // Calculate expenses (negative transactions)
        const expenseTransactions = transactions.filter(tx => parseFloat(tx.amount) < 0);
        const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);

        // Calculate net balance
        const netBalance = totalIncome - totalExpenses;

        // Update values in the modal
        updateElementText('modal-net-balance-value', formatCurrency(netBalance));
        updateElementText('modal-balance-income-value', formatCurrency(totalIncome));
        updateElementText('modal-balance-expenses-value', formatCurrency(totalExpenses));

        // Load top income sources
        const incomeBySource = {};
        incomeTransactions.forEach(tx => {
            const source = tx.category || 'Other Income';
            if (!incomeBySource[source]) {
                incomeBySource[source] = 0;
            }
            incomeBySource[source] += parseFloat(tx.amount);
        });

        // Sort income sources by amount and take top 3
        const topIncomeSources = Object.entries(incomeBySource)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        // Generate HTML for top income sources
        const incomeSourcesContainer = document.getElementById('balance-income-sources');
        if (incomeSourcesContainer) {
            if (topIncomeSources.length === 0) {
                incomeSourcesContainer.innerHTML = '<p class="text-muted">No income sources found</p>';
            } else {
                let sourcesHTML = '';
                topIncomeSources.forEach(([source, amount]) => {
                    const percentage = ((amount / totalIncome) * 100).toFixed(1);

                    sourcesHTML += `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span>${source}</span>
                            <span class="text-success">${formatCurrency(amount)} <small class="text-muted">(${percentage}%)</small></span>
                        </div>
                    `;
                });
                incomeSourcesContainer.innerHTML = sourcesHTML;
            }
        }

        // Load top expense categories
        const expensesByCategory = {};
        expenseTransactions.forEach(tx => {
            const category = tx.category || 'Uncategorized';
            if (!expensesByCategory[category]) {
                expensesByCategory[category] = 0;
            }
            expensesByCategory[category] += Math.abs(parseFloat(tx.amount));
        });

        // Sort expense categories by amount and take top 3
        const topExpenseCategories = Object.entries(expensesByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        // Generate HTML for top expense categories
        const expenseCategoriesContainer = document.getElementById('balance-expense-categories');
        if (expenseCategoriesContainer) {
            if (topExpenseCategories.length === 0) {
                expenseCategoriesContainer.innerHTML = '<p class="text-muted">No expense categories found</p>';
            } else {
                let categoriesHTML = '';
                topExpenseCategories.forEach(([category, amount]) => {
                    const percentage = ((amount / totalExpenses) * 100).toFixed(1);

                    categoriesHTML += `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span>${category}</span>
                            <span class="text-danger">${formatCurrency(amount)} <small class="text-muted">(${percentage}%)</small></span>
                        </div>
                    `;
                });
                expenseCategoriesContainer.innerHTML = categoriesHTML;
            }
        }

    } catch (error) {
    }
}

// Open net income modal
export async function openNetIncomeModal() {
    debugger

    try {
      if (typeof document === 'undefined') return; // SSR guard
  
      // Dynamically import Bootstrap Modal only on client
      const { default: Modal } = await import('bootstrap/js/dist/modal');
  
      const modalElement = document.getElementById('net-income-modal');
      if (!modalElement) throw new Error('Modal element not found');
  
      const modal = new Modal(modalElement);
      modal.show();
  
      loadIncomeDetails();
      console.log('Net income modal opened successfully');
    } catch (error) {
        debugger
      console.error(`Error opening net income modal: ${error.message}`);
      alert(
        'An error occurred while opening the net income details. Please refresh the page.',
        'danger'
      );
    }
  }

  // Show add goal form
function showAddGoalForm() {

    try {
        const goalsModal = document.getElementById('goals-modal');
        if (!goalsModal) {
            return;
        }

        const goalsContainer = goalsModal.querySelector('#goals-container');

        // Create form HTML
        goalsContainer.innerHTML = `
            <h5 class="mb-4">Add New Financial Goal</h5>
            
            <form id="add-goal-form">
                <div class="mb-3">
                    <label for="goal-name" class="form-label">Goal Name</label>
                    <input type="text" class="form-control" id="goal-name" required>
                </div>
                
                <div class="mb-3">
                    <label for="goal-description" class="form-label">Description (Optional)</label>
                    <textarea class="form-control" id="goal-description" rows="2"></textarea>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label for="goal-current-amount" class="form-label">Current Amount ($)</label>
                        <input type="number" class="form-control" id="goal-current-amount" min="0" step="0.01" value="0" required>
                    </div>
                    <div class="col-md-6">
                        <label for="goal-target-amount" class="form-label">Target Amount ($)</label>
                        <input type="number" class="form-control" id="goal-target-amount" min="0" step="0.01" required>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label for="goal-due-date" class="form-label">Due Date</label>
                    <input type="date" class="form-control" id="goal-due-date" required>
                </div>
                
                <div class="mb-3">
                    <label for="goal-category" class="form-label">Category</label>
                    <select class="form-select" id="goal-category" required>
                        <option value="">Select category</option>
                        <option value="Emergency Fund">Emergency Fund</option>
                        <option value="Savings">Savings</option>
                        <option value="Debt Payoff">Debt Payoff</option>
                        <option value="Retirement">Retirement</option>
                        <option value="Home">Home</option>
                        <option value="Car">Car</option>
                        <option value="Education">Education</option>
                        <option value="Travel">Travel</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                
                <div class="d-flex justify-content-end mt-4">
                    <button type="button" class="btn btn-secondary me-2" id="cancel-goal-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Goal</button>
                </div>
            </form>
        `;

        // Set minimum date for due date to today
        const today = new Date().toISOString().split('T')[0];
        const dueDateInput = document.getElementById('goal-due-date');
        if (dueDateInput) {
            dueDateInput.min = today;
        }

        // Add event listener for form submission
        const addGoalForm = document.getElementById('add-goal-form');
        if (addGoalForm) {
            addGoalForm.addEventListener('submit', function (e) {
                e.preventDefault();
                // saveGoal();
            });
        }

        // Add event listener for cancel button
        const cancelGoalBtn = document.getElementById('cancel-goal-btn');
        if (cancelGoalBtn) {
            cancelGoalBtn.addEventListener('click', function () {
                // Reload goals content
                // loadGoalsContent(goalsModal);
            });
        }
    } catch (error) {
        alert('An error occurred while showing the add goal form. Please try again.', 'danger');
    }
}


// Load goals content
function loadGoalsContent(modalElement) {

    try {
        const goalsContainer = modalElement.querySelector('#goals-container');
        const loadingIndicator = modalElement.querySelector('#goals-loading');

        if (!goalsContainer) {
            return;
        }

        // Get goals from localStorage
        const goals = JSON.parse(localStorage.getItem('financialGoals') || '[]');

        // Hide loading indicator
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        if (goals.length === 0) {
            // No goals yet
            goalsContainer.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-bullseye fa-3x text-muted mb-3"></i>
                    <p>No financial goals set yet. Click "Add New Goal" to get started on your financial journey!</p>
                </div>
            `;
            return;
        }

        // Calculate total saved across all goals
        const totalSaved = goals.reduce((sum, goal) => sum + parseFloat(goal.currentAmount || 0), 0);
        const totalTarget = goals.reduce((sum, goal) => sum + parseFloat(goal.targetAmount || 0), 0);
        const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

        let goalsHTML = `
            <div class="card mb-4">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="mb-0">Overall Progress</h5>
                        <span class="badge bg-primary">${overallProgress.toFixed(1)}%</span>
                    </div>
                    <div class="progress mb-3" style="height: 15px;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${overallProgress}%" 
                            aria-valuenow="${overallProgress}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Total Saved: ${formatCurrency(totalSaved)}</span>
                        <span class="text-muted">Target: ${formatCurrency(totalTarget)}</span>
                    </div>
                </div>
            </div>
            
            <h5 class="mb-3">Your Active Goals (${goals.length})</h5>
        `;

        // Sort goals by priority or progress
        goals.sort((a, b) => {
            // Sort by completion percentage (ascending)
            const aProgress = a.targetAmount > 0 ? (a.currentAmount / a.targetAmount) * 100 : 0;
            const bProgress = b.targetAmount > 0 ? (b.currentAmount / b.targetAmount) * 100 : 0;
            return aProgress - bProgress;
        });

        // Add goal cards
        goals.forEach((goal, index) => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const dueDate = new Date(goal.dueDate).toLocaleDateString();

            // Determine progress bar color
            let progressBarColor = 'bg-success';
            if (progress < 25) progressBarColor = 'bg-danger';
            else if (progress < 50) progressBarColor = 'bg-warning';
            else if (progress < 75) progressBarColor = 'bg-info';

            goalsHTML += `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h5 class="mb-1">${goal.name}</h5>
                                <span class="text-muted small">${goal.description || 'No description'}</span>
                            </div>
                            <div class="text-end">
                                <span class="badge ${progress >= 100 ? 'bg-success' : 'bg-primary'}">${progress.toFixed(1)}%</span>
                                <div class="mt-1">
                                    <button class="btn btn-sm btn-outline-primary edit-goal-btn" data-index="${index}">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger delete-goal-btn" data-index="${index}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="progress mb-3" style="height: 10px;">
                            <div class="progress-bar ${progressBarColor}" role="progressbar" style="width: ${progress}%" 
                                aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-muted">Current: ${formatCurrency(goal.currentAmount)}</span>
                            <span class="text-muted">Target: ${formatCurrency(goal.targetAmount)}</span>
                        </div>
                        
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-sm btn-success update-goal-btn" data-index="${index}">
                                <i class="fas fa-plus me-1"></i>Update Progress
                            </button>
                            <span class="text-muted small">Due: ${dueDate}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        // Add information about goals
        goalsHTML += `
            <div class="alert alert-light border mt-3">
                <div class="d-flex">
                    <div class="me-3">
                        <i class="fas fa-lightbulb text-warning"></i>
                    </div>
                    <div>
                        <span class="small">
                            Setting SMART financial goals (Specific, Measurable, Achievable, Relevant, Time-bound) 
                            can increase your chances of success by up to 76% according to research.
                        </span>
                    </div>
                </div>
            </div>
        `;

        // Update container with goals
        goalsContainer.innerHTML = goalsHTML;

        // Add event listeners for goal actions
        goalsContainer.querySelectorAll('.edit-goal-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = this.dataset.index;
                // editGoal(index);
            });
        });

        goalsContainer.querySelectorAll('.delete-goal-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = this.dataset.index;
                // deleteGoal(index);
            });
        });

        goalsContainer.querySelectorAll('.update-goal-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = this.dataset.index;
                // updateGoalProgress(index);
            });
        });

    } catch (error) {
        if (modalElement) {
            modalElement.querySelector('#goals-container').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    An error occurred while loading your goals. Please try again.
                </div>
            `;
        }
    }
}


  // Open goals modal
async function openGoalsModal() {

    try {
   // Dynamically import Bootstrap Modal only on client
   const { default: Modal } = await import('bootstrap/js/dist/modal');

        // Get or create modal element
        let modalElement = document.getElementById('goals-modal');

        // If modal doesn't exist, create it
        if (!modalElement) {
            modalElement = document.createElement('div');
            modalElement.id = 'goals-modal';
            modalElement.className = 'modal fade';
            modalElement.setAttribute('tabindex', '-1');
            modalElement.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-bullseye text-warning me-2"></i>Financial Goals
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="goals-container">
                                <div class="text-center p-5" id="goals-loading">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-3">Loading your financial goals...</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" id="add-new-goal-btn">
                                <i class="fas fa-plus me-1"></i>Add New Goal
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalElement);

            // Add event listener for the add new goal button
            const addNewGoalBtn = document.getElementById('add-new-goal-btn');
            if (addNewGoalBtn) {
                addNewGoalBtn.addEventListener('click', function () {
                    showAddGoalForm();
                });
            }
        }

        // Show the modal
        const modal = new Modal(modalElement);
        modal.show();

        // Load goals data after modal is shown
        modalElement.addEventListener('shown.bs.modal', function () {
            loadGoalsContent(modalElement);
        }, { once: true });

        log('Goals modal opened successfully');
    } catch (error) {
        log(`Error opening goals modal: ${error.message}`, 'error');
        showAlert('An error occurred while opening the goals. Please refresh the page.', 'danger');
    }
}




// Open detailed expenses modal
async function openDetailedExpensesModal() {

    try {
        // Get modal element
        let modalElement = document.getElementById('detailed-expenses-modal');
        const { default: Modal } = await import('bootstrap/js/dist/modal');

        // Show the modal
        const modal = new Modal(modalElement);
        modal.show();

        // Load expense transactions
        loadDetailedExpenses();

        // Setup search functionality
        setupExpenseSearch();

    } catch (error) {
        alert('An error occurred while opening the detailed expenses. Please refresh the page.', 'danger');
    }
}


function setupFinancialFeatureHandlers() {

    try {
        // For Net Income card - using direct ID
        // const incomeCard = document.getElementById('net-income-card');
        // if (incomeCard && !incomeCard._hasIncomeClickHandler) {
        //     incomeCard.addEventListener('click', function () {
 
        //         openNetIncomeModal();
        //     });
        //     incomeCard._hasIncomeClickHandler = true;
        // } else {
        // }

        // // For Net Income nav link in sidebar - using direct ID
        // const incomeNavLink = document.getElementById('net-income-nav-link');
        // if (incomeNavLink && !incomeNavLink._hasIncomeClickHandler) {
        //     incomeNavLink.addEventListener('click', function (e) {
        //         e.preventDefault();
        //         openNetIncomeModal();
        //     });
        //     incomeNavLink._hasIncomeClickHandler = true;
        // } else {
        // }

        // // For Goals card - using direct ID
        // const goalsCard = document.getElementById('goals-card');
        // if (goalsCard && !goalsCard._hasGoalsClickHandler) {
        //     goalsCard.addEventListener('click', function () {
    
        //         openGoalsModal();
        //     });
        //     goalsCard._hasGoalsClickHandler = true;
        // } else {
        // }

        // // Goals nav link
        // const goalsNavLink = document.getElementById('goals-nav-link');
        // if (goalsNavLink && !goalsNavLink._hasGoalsClickHandler) {
        //     goalsNavLink.addEventListener('click', function (e) {
        //         e.preventDefault();
        //         openGoalsModal();
        //     });
        //     goalsNavLink._hasGoalsClickHandler = true;
        // } else {
        // }

        // // For Net Balance card - using direct ID
        const balanceCard = document.getElementById('net-balance-card');
        debugger
        if (balanceCard && !balanceCard._hasBalanceClickHandler) {
            balanceCard.addEventListener('click', function () {
                openNetBalanceModal();
            });
            balanceCard._hasBalanceClickHandler = true;
        } else {
        }

        // // For Net Balance nav link in sidebar - using direct ID
        // const balanceNavLink = document.getElementById('net-balance-nav-link');
        // if (balanceNavLink && !balanceNavLink._hasBalanceClickHandler) {
        //     balanceNavLink.addEventListener('click', function (e) {
        //         e.preventDefault();
        //         // openNetBalanceModal();
        //     });
        //     balanceNavLink._hasBalanceClickHandler = true;
        // } else {
        // }

        // // For Subscriptions card - using direct ID
        // const subscriptionsCard = document.getElementById('subscriptions-card');
        // if (subscriptionsCard && !subscriptionsCard._hasSubscriptionsClickHandler) {
        //     subscriptionsCard.addEventListener('click', function () {

        //         // openSubscriptionsModal();
        //     });
        //     subscriptionsCard._hasSubscriptionsClickHandler = true;
        // } else {
        // }

        // // For Subscriptions nav link in sidebar - using direct ID
        // const subscriptionsNavLink = document.getElementById('subscriptions-nav-link');
        // if (subscriptionsNavLink && !subscriptionsNavLink._hasSubscriptionsClickHandler) {
        //     subscriptionsNavLink.addEventListener('click', function (e) {
        //         e.preventDefault();
        //         // openSubscriptionsModal();
        //     });
        //     subscriptionsNavLink._hasSubscriptionsClickHandler = true;
        // } else {
        // }

        // Set up modal navigation buttons
        const viewAllExpensesBtn = document.getElementById('view-all-expenses-btn');
        if (viewAllExpensesBtn) {
            viewAllExpensesBtn.addEventListener('click', async function () {
                const { default: Modal } = await import('bootstrap/js/dist/modal');
                // Close the categories modal
                const categoriesModal = Modal.getInstance(document.getElementById('expense-categories-modal'));
                if (categoriesModal) categoriesModal.hide();

                // Open the detailed expenses modal
                setTimeout(() => openDetailedExpensesModal(), 400);
            });
        }

        const viewExpenseCategoriesBtn = document.getElementById('view-expense-categories-btn');

        if (viewExpenseCategoriesBtn) {
          viewExpenseCategoriesBtn.addEventListener('click', async function () {
            // Prevent multiple rapid clicks
            viewExpenseCategoriesBtn.disabled = true;
        
            try {
              const { default: Modal } = await import('bootstrap/js/dist/modal');
        
              const modalElement = document.getElementById('detailed-expenses-modal');
              if (modalElement) {
                const detailedModal = Modal.getInstance(modalElement);
                if (detailedModal) detailedModal.hide();
              }
        
              // Open the categories modal after a short delay
              setTimeout(() => {
                openExpenseCategoriesModal();
        
                // Re-enable the button after modal is fully rendered
                setTimeout(() => {
                  viewExpenseCategoriesBtn.disabled = false;
                }, 600); // adjust to match Bootstrap modal animation duration
              }, 400);
            } catch (error) {
              console.error('Failed to open modal:', error);
              viewExpenseCategoriesBtn.disabled = false;
            }
          });
        }

        // // Set up balance modal navigation buttons
        const viewAllIncomeFromBalanceBtn = document.getElementById('view-all-income-from-balance-btn');
        if (viewAllIncomeFromBalanceBtn) {
            debugger
            viewAllIncomeFromBalanceBtn.addEventListener('click', async function () {
                const { default: Modal } = await import('bootstrap/js/dist/modal');

                // Close the balance modal
                const balanceModal = Modal.getInstance(document.getElementById('net-balance-modal'));
                if (balanceModal) balanceModal.hide();

                // Open the income modal
                setTimeout(() => openNetIncomeModal(), 400);
            });
        }

        const viewAllExpensesFromBalanceBtn = document.getElementById('view-all-expenses-from-balance-btn');
        if (viewAllExpensesFromBalanceBtn) {
            viewAllExpensesFromBalanceBtn.addEventListener('click', async function () {
                const { default: Modal } = await import('bootstrap/js/dist/modal');

                // Close the balance modal
                const balanceModal = Modal.getInstance(document.getElementById('net-balance-modal'));
                if (balanceModal) balanceModal.hide();

                // Open the detailed expenses modal
                setTimeout(() => openDetailedExpensesModal(), 400);
            });
        }

        // // Data dashboard link
        // const dataDashboardLink = document.getElementById('data-dashboard-nav-link');
        // if (dataDashboardLink && !dataDashboardLink._hasClickHandler) {
        //     dataDashboardLink.addEventListener('click', function (e) {
        //         e.preventDefault();
        //         // loadDataDashboard();
        //     });
        //     dataDashboardLink._hasClickHandler = true;
        // }

        // // Bank Accounts nav link
        // const bankAccountsNavLink = document.getElementById('bank-accounts-nav-link');
        // if (bankAccountsNavLink && !bankAccountsNavLink._hasBankAccountsClickHandler) {
        //     bankAccountsNavLink.addEventListener('click', function (e) {
        //         e.preventDefault();
        //         log('Bank Accounts nav link clicked');
        //         // openBankAccountsModal();
        //     });
        //     bankAccountsNavLink._hasBankAccountsClickHandler = true;
        // } else {
        // }

    } catch (error) {
    }
}


export {
    generateMockTransactions,
    initializeMockData,
    formatCurrency,
    updateElementText,
    displayTransactionSummary,
    loadIncomeDetails,
    loadDetailedExpenses,setupExpenseSearch,
    openExpenseCategoriesModal,
    setupFinancialFeatureHandlers,
    openNetBalanceModal
}