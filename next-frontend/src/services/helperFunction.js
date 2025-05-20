import Chart from '@/components/utils/chartSetup';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

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
            // localStorage.setItem('bankTransactions', JSON.stringify(transactions));

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
            // localStorage.setItem('financialGoals', JSON.stringify(goals));


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

async function displayTransactionSummary() {
    try {
        // Get transactions from localStorage

        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);

            // Map Firestore docs to Expense[]
            const transactions = snapshot.docs.map(doc => doc.data())

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
        })
    } catch (error) {
        console.log('errorr', error);

    }
}

// Load income details
async function loadIncomeDetails() {

    try {
        // Get transactions from localStorage

        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);

            // Map Firestore docs to Expense[]
            const transactions = snapshot.docs.map(doc => doc.data());
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

                sourcesContainer.innerHTML = sourcesHTML;
            }
        })
    } catch (error) {
        console.log(`Error loading income details: ${error.message}`, 'error');
    }
}


// Perform expense search
export async function performExpenseSearch(term, setFilteredExpenses) {
    try {
        const searchTerm = term.toLowerCase().trim();


        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);

            // Map Firestore docs to Expense[]
            const transactions = snapshot.docs.map(doc => doc.data())
            const expenses = transactions.filter((tx) => parseFloat(tx.amount) < 0);

            const filteredExpenses = expenses.filter((expense) => {
                return (
                    (expense.description && expense.description.toLowerCase().includes(searchTerm)) ||
                    (expense.merchant && expense.merchant.toLowerCase().includes(searchTerm)) ||
                    (expense.category && expense.category.toLowerCase().includes(searchTerm)) ||
                    (expense.accountName && expense.accountName.toLowerCase().includes(searchTerm))
                );
            });

            // Sort filtered results
            filteredExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Update state
            setFilteredExpenses(filteredExpenses);
        })
    } catch (error) {
        console.log(`Error performing expense search: ${error.message}`);
    }
}


// set up search
function setupExpenseSearch() {
    try {
        const searchInput = document.getElementById('expense-search');

        if (!searchInput) return;

        // Prevent duplicate listener setup
        if ((searchInput)._hasSearchHandler) return;

        let debounceTimeout

        const onSearchChange = () => {
            const value = searchInput.value.trim();

            if (debounceTimeout) clearTimeout(debounceTimeout);

            debounceTimeout = setTimeout(() => {
                if (value === '') {
                    loadDetailedExpenses();
                } else {
                    performExpenseSearch();
                }
            }, 400); // debounce delay
        };

        searchInput.addEventListener('input', onSearchChange);
        (searchInput)._hasSearchHandler = true; // mark as initialized
    } catch (error) {
        console.error('Error setting up expense search:', error);
    }
}


// Open expense categories modal
async function openExpenseCategoriesModal() {
    if (typeof document === 'undefined') return;

    const { default: Modal } = await import('bootstrap/js/dist/modal');

    let modalElement = document.getElementById('expense-categories-modal');

    if (!modalElement) {
        modalElement = document.createElement('div');
        modalElement.id = 'expense-categories-modal';
        modalElement.className = 'modal fade';
        modalElement.setAttribute('tabindex', '-1');
        modalElement.innerHTML = `
      <div class="modal-dialog modal-lg" style="z-index: 99999;">
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

        // Apply z-index to the modal container directly as well
        modalElement.style.zIndex = '99999';

        document.body.appendChild(modalElement);
    }

    const modal = new Modal(modalElement);

    modalElement.addEventListener(
        'hidden.bs.modal',
        () => {
            setTimeout(() => {
                modal.dispose();
                modalElement.remove();
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
            }, 100);
        },
        { once: true }
    );

    modalElement.addEventListener(
        'shown.bs.modal',
        () => loadExpenseCategoriesContent(modalElement),
        { once: true }
    );

    modal.show();
}

// Load detailed expenses
async function loadDetailedExpenses() {

    try {
        // Get transactions from localStorage

        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);

            // Map Firestore docs to Expense[]
            const transactions = snapshot.docs.map(doc => doc.data())
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
        })
    } catch (error) {
        console.log(`Error loading detailed expenses: ${error.message}`, 'error');
    }
}

async function loadExpenseCategoriesContent(modalElement) {
    try {

        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);
            const transactions = snapshot.docs.map(doc => doc.data());
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

            const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);

            const categoryMap = {};
            expenses.forEach(tx => {
                const category = tx.category || 'Uncategorized';
                categoryMap[category] = (categoryMap[category] || 0) + Math.abs(parseFloat(tx.amount));
            });

            const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

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

            modalElement.querySelector('.modal-body').innerHTML = `
      <div class="row mb-4">
        <div class="col-12">
          <div class="card bg-light">
            <div class="card-body d-flex justify-content-between align-items-center">
              <h4 class="mb-0">Total Expenses</h4>
              <h3 class="text-danger mb-0">$${totalExpenses.toFixed(2)}</h3>
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
        })
    } catch (error) {
        console.error('Failed to load expense categories:', error);
        modalElement.querySelector('.modal-body').innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        An error occurred while loading expense data. Please try again.
      </div>
    `;
    }
}

// Open net balance modal
async function openNetBalanceModal() {

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
        showToast('An error occurred while opening the net balance details. Please refresh the page.', 'danger');
    }
}

// Load net balance details
async function loadNetBalanceDetails() {

    try {
        // Get transactions from localStorage

        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);

            // Map Firestore docs to Expense[]
            const transactions = snapshot.docs.map(doc => doc.data())

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
        })
    } catch (error) {
    }
}

// Open net income modal
export async function openNetIncomeModal() {


    try {
        if (typeof document === 'undefined') return; // SSR guard

        // Dynamically import Bootstrap Modal only on client
        const { default: Modal } = await import('bootstrap/js/dist/modal');

        const modalElement = document.getElementById('net-income-modal');
        if (!modalElement) throw new Error('Modal element not found');

        const modal = Modal(modalElement);
        modal.show();

        loadIncomeDetails();
        console.log('Net income modal opened successfully');
    } catch (error) {

        console.error(`Error opening net income modal: ${error.message}`);
        showToast(
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
                saveGoal();
            });
        }

        // Add event listener for cancel button
        const cancelGoalBtn = document.getElementById('cancel-goal-btn');
        if (cancelGoalBtn) {
            cancelGoalBtn.addEventListener('click', function () {
                // Reload goals content
                loadGoalsContent(goalsModal);
            });
        }
    } catch (error) {
        showToast('An error occurred while showing the add goal form. Please try again.', 'danger');
    }
}



// Save goal
// function saveGoal(editIndex = null) {
// debugger
//  let isSubmitting = false;
//     if (isSubmitting) return; // Prevent double submission
//     isSubmitting = true;
//     const saveBtn = document.querySelector('#');
//     const originalBtnText = saveBtn ? saveBtn.innerHTML : '';

//     if (saveBtn) {
//         saveBtn.disabled = true;
//         saveBtn.innerHTML = `
//             <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
//             Saving...
//         `;
//     }

//     try {
//         // Get form values
//         const name = document.getElementById('goal-name').value;
//         const description = document.getElementById('goal-description').value;
//         const currentAmount = parseFloat(document.getElementById('goal-current-amount').value) || 0;
//         const targetAmount = parseFloat(document.getElementById('goal-target-amount').value) || 0;
//         const dueDate = document.getElementById('goal-due-date').value;
//         const category = document.getElementById('goal-category').value;

//         // Validate inputs
//         if (!name || !targetAmount || !dueDate || !category) {
//             // log('Invalid goal form inputs', 'warn');
//             showToast('Please fill all required fields.', 'warning');
//             return;
//         }

//         // Create goal object
//         const goal = {
//             id: editIndex !== null ? getGoals()[editIndex].id : Date.now(),
//             name,
//             description,
//             currentAmount,
//             targetAmount,
//             dueDate,
//             category,
//             createdAt: editIndex !== null ? getGoals()[editIndex].createdAt : new Date().toISOString(),
//             updatedAt: new Date().toISOString()
//         };

//         // Get existing goals
//         const goals = getGoals();

//         // Update or add goal
//         if (editIndex !== null) {
//             goals[editIndex] = goal;
//         } else {
//             goals.push(goal);
//         }

//         // Save to localStorage
//         localStorage.setItem('financialGoals', JSON.stringify(goals));

//         // Show success message
//         showToast(`Goal "${name}" ${editIndex !== null ? 'updated' : 'added'} successfully!`, 'success');

//         // Reload goals content
//         const goalsModal = document.getElementById('goals-modal');
//         if (goalsModal) {
//             loadGoalsContent(goalsModal);
//         }

//         // Update dashboard if needed
//         updateGoalsDisplay();

//         // log('Goal saved successfully');
//     } catch (error) {
//         // log(`Error saving goal: ${error.message}`, 'error');
//         showToast('An error occurred while saving the goal. Please try again.', 'danger');
//     }finally {
//         // Always reset button and state
//         if (saveBtn) {
//             saveBtn.disabled = false;
//             saveBtn.innerHTML = originalBtnText;
//         }
//         isSubmitting = false;
//     }
// }

// Edit goal
export function editGoal(index) {

    // log('Editing goal');

    try {
        const goals = getGoals();
        const goal = goals[index];

        if (!goal) {
            console.log('Goal not found for editing', 'warn');
            return;
        }

        showAddGoalForm();

        // Populate form with goal data
        document.getElementById('goal-name').value = goal.name || '';
        document.getElementById('goal-description').value = goal.description || '';
        document.getElementById('goal-current-amount').value = goal.currentAmount || 0;
        document.getElementById('goal-target-amount').value = goal.targetAmount || 0;
        document.getElementById('goal-due-date').value = goal.dueDate || '';
        document.getElementById('goal-category').value = goal.category || '';

        // Update form title and submit button
        const formTitle = document.querySelector('#goals-modal h5');
        if (formTitle) formTitle.textContent = 'Edit Financial Goal';

        const submitButton = document.querySelector('#add-goal-form button[type="submit"]');
        if (submitButton) submitButton.textContent = 'Update Goal';

        // Update form submission to save as edit
        const addGoalForm = document.getElementById('add-goal-form');
        if (addGoalForm) {
            // Remove existing listeners
            const newForm = addGoalForm.cloneNode(true);
            addGoalForm.parentNode.replaceChild(newForm, addGoalForm);

            // Add new listener for editing
            newForm.addEventListener('submit', function (e) {
                e.preventDefault();
                saveGoal(index);
            });
        }

        // Update cancel button
        const cancelGoalBtn = document.getElementById('cancel-goal-btn');
        if (cancelGoalBtn) {
            cancelGoalBtn.addEventListener('click', function () {
                loadGoalsContent(document.getElementById('goals-modal'));
            });
        }

        // log('Goal edit form populated successfully');
    } catch (error) {
        // log(`Error editing goal: ${error.message}`, 'error');
        showToast('An error occurred while editing the goal. Please try again.', 'danger');
    }
}

// Delete goal
function deleteGoal(index) {
    // log('Deleting goal');

    try {
        const goals = getGoals();
        const goal = goals[index];

        if (!goal) {
            console.log('Goal not found for deletion', 'warn');
            return;
        }

        // Confirm deletion
        if (!confirm(`Are you sure you want to delete the goal "${goal.name}"?`)) {
            return;
        }

        // Remove goal from array
        goals.splice(index, 1);

        // Save to localStorage
        // localStorage.setItem('financialGoals', JSON.stringify(goals));

        // Show success message
        showToast(`Goal "${goal.name}" deleted successfully!`, 'success');

        // Reload goals content
        const goalsModal = document.getElementById('goals-modal');
        if (goalsModal) {
            loadGoalsContent(goalsModal);
        }

        // Update dashboard if needed
        updateGoalsDisplay();

        // log('Goal deleted successfully');
    } catch (error) {
        // log(`Error deleting goal: ${error.message}`, 'error');
        showToast('An error occurred while deleting the goal. Please try again.', 'danger');
    }
}

// Update goal progress
function updateGoalProgress(index) {
    // log('Updating goal progress');

    try {
        const goals = getGoals();
        const goal = goals[index];

        if (!goal) {
            console.log('Goal not found for progress update', 'warn');
            return;
        }

        // Ask for new contribution amount
        const amount = prompt(`Enter additional amount to add to "${goal.name}" (current: ${formatCurrency(goal.currentAmount)}):`, "0");

        if (amount === null) {
            return; // User cancelled
        }

        const additionalAmount = parseFloat(amount);

        if (isNaN(additionalAmount) || additionalAmount < 0) {
            showToast('Please enter a valid positive number.', 'warning');
            return;
        }

        // Update goal
        goal.currentAmount = (parseFloat(goal.currentAmount) || 0) + additionalAmount;
        goal.updatedAt = new Date().toISOString();

        // Cap at target amount
        if (goal.currentAmount > goal.targetAmount) {
            if (confirm(`You've exceeded your target! Would you like to cap at the target amount (${formatCurrency(goal.targetAmount)})?`)) {
                goal.currentAmount = goal.targetAmount;
            }
        }

        // Save to localStorage
        // localStorage.setItem('financialGoals', JSON.stringify(goals));

        // Show success message
        showToast(`Added ${formatCurrency(additionalAmount)} to "${goal.name}" successfully!`, 'success');

        // Reload goals content
        const goalsModal = document.getElementById('goals-modal');
        if (goalsModal) {
            loadGoalsContent(goalsModal);
        }

        // Update dashboard if needed
        updateGoalsDisplay();

        // log('Goal progress updated successfully');
    } catch (error) {
        // log(`Error updating goal progress: ${error.message}`, 'error');
        showToast('An error occurred while updating the goal progress. Please try again.', 'danger');
    }
}

// Get goals helper
function getGoals() {
    return JSON.parse(localStorage.getItem('financialGoals') || '[]');
}

// Update goals display on dashboard
function updateGoalsDisplay() {
    // log('Updating goals display on dashboard');

    try {
        const goals = getGoals();

        // Get dashboard goals card content
        const goalsCard = document.querySelector('[data-tile-type="goals"] .scrollable-content');
        if (!goalsCard) {
            console.log('Goals card not found for updating', 'warn');
            return;
        }

        if (goals.length === 0) {
            goalsCard.innerHTML = `
                        <h3>No Active Goals</h3>
                        <div class="text-center py-4">
                            <i class="fas fa-bullseye fa-3x text-muted mb-3"></i>
                            <p>You haven't set any financial goals yet.</p>
                            <button class="btn btn-sm btn-primary mt-2" id="add-first-goal-btn">
                                <i class="fas fa-plus me-1"></i>Add Your First Goal
                            </button>
                        </div>
                    `;

            // Add event listener for add first goal button
            const addFirstGoalBtn = document.getElementById('add-first-goal-btn');
            if (addFirstGoalBtn) {
                addFirstGoalBtn.addEventListener('click', function () {
                    openGoalsModal();
                });
            }

            return;
        }

        // Sort goals by progress (ascending)
        goals.sort((a, b) => {
            const aProgress = a.targetAmount > 0 ? (a.currentAmount / a.targetAmount) * 100 : 0;
            const bProgress = b.targetAmount > 0 ? (b.currentAmount / b.targetAmount) * 100 : 0;
            return aProgress - bProgress;
        });

        // Take the top 3 goals for display
        const topGoals = goals.slice(0, 3);

        // Calculate overall progress
        const totalSaved = goals.reduce((sum, goal) => sum + parseFloat(goal.currentAmount || 0), 0);
        const totalTarget = goals.reduce((sum, goal) => sum + parseFloat(goal.targetAmount || 0), 0);
        const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

        // Generate HTML
        let goalsHTML = `
                    <h3>${goals.length} Active Goal${goals.length !== 1 ? 's' : ''}</h3>
                    <div class="stat-change positive-change mb-4">
                        <i class="fas fa-check-circle"></i> ${overallProgress.toFixed(1)}% Overall Progress
                    </div>
                `;

        // Add goal items
        topGoals.forEach(goal => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const dueDate = new Date(goal.dueDate).toLocaleDateString();

            goalsHTML += `
                        <div class="goal-item">
                            <div class="goal-details">
                                <span>${goal.name}</span>
                                <span class="text-success">${formatCurrency(goal.currentAmount)}</span>
                            </div>
                            <div class="progress">
                                <div class="progress-bar bg-success" role="progressbar" style="width: ${progress}%" 
                                    aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <div class="d-flex justify-content-between">
                                <small>${formatCurrency(goal.currentAmount)} of ${formatCurrency(goal.targetAmount)}</small>
                                <small>Due: ${dueDate}</small>
                            </div>
                        </div>
                    `;
        });

        // Add "View All" if there are more than 3 goals
        if (goals.length > 3) {
            goalsHTML += `
                        <div class="text-center mt-3">
                            <button class="btn btn-sm btn-outline-primary" id="view-all-goals-btn">
                                View All ${goals.length} Goals
                            </button>
                        </div>
                    `;
        }

        // Update the card
        goalsCard.innerHTML = goalsHTML;

        // Add event listener for view all button
        const viewAllGoalsBtn = document.getElementById('view-all-goals-btn');
        if (viewAllGoalsBtn) {
            viewAllGoalsBtn.addEventListener('click', function () {
                openGoalsModal();
            });
        }

        // log('Goals display updated successfully');
    } catch (error) {
        console.log(`Error updating goals display: ${error.message}`, 'error');
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
                editGoal(index);
            });
        });

        goalsContainer.querySelectorAll('.delete-goal-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = this.dataset.index;
                deleteGoal(index);
            });
        });

        goalsContainer.querySelectorAll('.update-goal-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = this.dataset.index;
                updateGoalProgress(index);
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


        modalElement.addEventListener(
            'hidden.bs.modal',
            () => {
                // Delay removal slightly to allow Bootstrap to remove modal-open, backdrop, etc.
                setTimeout(() => {
                    modal.dispose();           // clean up modal instance
                    modalElement.remove();     // remove modal DOM element

                    // ✅ Manually ensure body is scrollable again
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                }, 100); // 100ms is safe buffer
            },
            { once: true }
        );


        // Load goals data after modal is shown
        modalElement.addEventListener('shown.bs.modal', function () {
            loadGoalsContent(modalElement);
        }, { once: true });

        modal.show();

    } catch (error) {
        showToast('An error occurred while opening the goals. Please refresh the page.', 'danger');
    }
}






// Create expense category chart
function createExpenseCategoryChart(transactions) {
    // log('Creating expense category chart');

    try {
        const expensesByCategory = {};
        const expenses = transactions.filter(tx => parseFloat(tx.amount) < 0);

        // Group expenses by category
        expenses.forEach(tx => {
            const category = tx.category || 'Uncategorized';
            if (!expensesByCategory[category]) {
                expensesByCategory[category] = 0;
            }
            expensesByCategory[category] += Math.abs(parseFloat(tx.amount));
        });

        // Convert to arrays for chart
        const categories = Object.keys(expensesByCategory);
        const values = Object.values(expensesByCategory);

        // Generate colors
        const colors = categories.map((_, i) => {
            const hue = (i * 137) % 360; // Golden angle approximation for good distribution
            return `hsl(${hue}, 70%, 60%)`;
        });

        // Get chart canvas
        const ctx = document.getElementById('categoryChart');
        if (!ctx) {
            console.log('Category chart canvas not found', 'warn');
            return;
        }

        // Destroy existing chart if any
        if (window.categoryPieChart) {
            window.categoryPieChart.destroy();
        }

        // Create new chart
        window.categoryPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 15,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `$${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // console.log('Expense category chart created successfully');
    } catch (error) {
        console.log(`Error creating expense category chart: ${error.message}`, 'error');
    }
}

// Create expense time chart
function createExpenseTimeChart(transactions) {

    try {
        // Group expenses by date
        const expensesByDate = {};
        const incomeByDate = {};

        // Process transactions
        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount);
            const date = new Date(tx.date);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            if (amount < 0) { // Expense
                if (!expensesByDate[dateKey]) {
                    expensesByDate[dateKey] = 0;
                }
                expensesByDate[dateKey] += Math.abs(amount);
            } else { // Income
                if (!incomeByDate[dateKey]) {
                    incomeByDate[dateKey] = 0;
                }
                incomeByDate[dateKey] += amount;
            }
        });

        // Get all unique dates and sort them
        const allDates = [...new Set([...Object.keys(expensesByDate), ...Object.keys(incomeByDate)])].sort();

        // Prepare data for chart
        const expenseData = [];
        const incomeData = [];

        allDates.forEach(date => {
            expenseData.push({
                x: date,
                y: expensesByDate[date] || 0
            });

            incomeData.push({
                x: date,
                y: incomeByDate[date] || 0
            });
        });

        // Get chart canvas
        const ctx = document.getElementById('timeChart');
        if (!ctx) {
            console.log('Time chart canvas not found', 'warn');
            return;
        }

        // Destroy existing chart if any
        if (window.timeLineChart) {
            window.timeLineChart.destroy();
        }

        // Create new chart
        window.timeLineChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Income',
                        data: incomeData,
                        borderColor: '#198754',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            tooltipFormat: 'MMM d, yyyy'
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: $${context.raw.y.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });

        // log('Expense time chart created successfully');
    } catch (error) {
        console.log(`Error creating expense time chart: ${error.message}`, 'error');
    }
}


// Load transactions table
function loadTransactionsTable(transactions) {
    // log('Loading transactions table');


    try {
        const tableBody = document.getElementById('transactionsTableBody');


        if (!tableBody) {
            console.log('Transactions table body element not found', 'warn');
            return;
        }

        if (transactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <p>No transactions found</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort transactions by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        let tableRows = '';
        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount);
            const date = new Date(tx.date).toLocaleDateString();
            const type = amount >= 0 ? 'Income' : 'Expense';
            const amountClass = amount >= 0 ? 'text-success' : 'text-danger';

            tableRows += `
                <tr>
                    <td>${date}</td>
                    <td>${tx.merchant || 'Unknown'}</td>
                    <td>${tx.category || 'Uncategorized'}</td>
                    <td class="${amountClass}">$${Math.abs(amount).toFixed(2)}</td>
                    <td>${type}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = tableRows;

        // log('Transactions table loaded successfully');
    } catch (error) {


        console.groupEndlog(`Error loading transactions table: ${error.message}`, 'error');
    }
}


// Load data dashboard
async function loadDataDashboard() {

    try {
        const dashboardSection = document.getElementById('data-dashboard-section');
        if (!dashboardSection) {
            console.log('Data dashboard section element not found', 'error');
            return;
        }

        // Show dashboard section
        dashboardSection.style.display = 'block';

        // Load transactions

        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);

            // Map Firestore docs to Expense[]
            const transactions = snapshot.docs.map(doc => doc.data())

            // Load chart data if Chart.js is available
            if (typeof Chart !== 'undefined') {
                createExpenseCategoryChart(transactions);
                createExpenseTimeChart(transactions);
            }

            // Load transactions table
            loadTransactionsTable(transactions);

            // log('Data dashboard loaded successfully');
        })
    } catch (error) {
        console.log(`Error loading data dashboard: ${error.message}`, 'error');
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
        showToast('An error occurred while opening the detailed expenses. Please refresh the page.', 'danger');
    }
}


async function setupBankConnectionHandlers() {

    try {
        // Find Connect Bank button
        const connectBankBtn = document.getElementById('connect-bank-button');
        if (!connectBankBtn) {
            console.log('Connect Bank button not found', 'warn');
            return;
        }

        // Clear any existing onclick attributes to avoid conflicts
        connectBankBtn.removeAttribute('onclick');

        // Add click event listener - add a strong direct connection
        connectBankBtn.onclick = function () {
            console.log('Connect Bank button clicked');
            openBankConnectionModal();
        };

        // Mark as having event listener
        connectBankBtn._hasClickHandler = true;

    } catch (error) {
        console.log(`Error setting up bank connection handlers: ${error.message}`, 'error');
    }
}


// Open bank connection modal
async function openBankConnectionModal() {

    const { default: Modal } = await import('bootstrap/js/dist/modal');

    try {

        // Check if modal exists
        let modalElement = document.getElementById('bank-connection-modal');

        // If modal doesn't exist, create it
        if (!modalElement) {
            console.log('Bank connection modal not found, creating it');
            modalElement = createBankConnectionModal();
        }

        // Show the modal
        const modal = new Modal(modalElement);
        modal.show();

    } catch (error) {
        console.log(`Error opening bank connection modal: ${error.message}`, 'error');
        showToast('An error occurred while opening the bank connection dialog. Please refresh the page.', 'danger');
    }
}

// Create bank connection modal
function createBankConnectionModal() {

    try {
        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="bank-connection-modal" tabindex="-1" aria-labelledby="bank-connection-modal-label" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="bank-connection-modal-label">Connect Your Bank</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                You're in development mode. You can create mock data or add a custom bank account.
                            </div>
                            
                            <ul class="nav nav-tabs mb-3" id="bankConnectionTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="mock-tab" data-bs-toggle="tab" data-bs-target="#mock-content" type="button" role="tab" aria-controls="mock-content" aria-selected="true">Mock Connection</button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="custom-tab" data-bs-toggle="tab" data-bs-target="#custom-content" type="button" role="tab" aria-controls="custom-content" aria-selected="false">Add Custom Account</button>
                                </li>
                            </ul>
                            
                            <div class="tab-content" id="bankConnectionTabsContent">
                                <div class="tab-pane fade show active" id="mock-content" role="tabpanel" aria-labelledby="mock-tab">
                                    <p>Would you like to connect to your bank account and import mock transactions?</p>
                                    <button type="button" class="btn btn-primary w-100" id="complete-mock-connection">
                                        <i class="fas fa-check me-2"></i>Complete Mock Connection
                                    </button>
                                </div>
                                <div class="tab-pane fade" id="custom-content" role="tabpanel" aria-labelledby="custom-tab">
                                    <form id="custom-bank-form">
                                        <div class="mb-3">
                                            <label for="bank-name" class="form-label">Bank Name</label>
                                            <input type="text" class="form-control" id="bank-name" required>
                                        </div>
                                        <div class="mb-3">
                                            <label for="account-type" class="form-label">Account Type</label>
                                            <select class="form-select" id="account-type" required>
                                                <option value="">Select account type</option>
                                                <option value="checking">Checking Account</option>
                                                <option value="savings">Savings Account</option>
                                                <option value="credit">Credit Card</option>
                                                <option value="investment">Investment Account</option>
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                            <label for="account-number" class="form-label">Account Number (last 4 digits)</label>
                                            <input type="text" class="form-control" id="account-number" maxlength="4" pattern="[0-9]{4}" required>
                                            <div class="form-text">For demo purposes only, enter any 4 digits</div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="initial-balance" class="form-label">Initial Balance</label>
                                            <div class="input-group">
                                                <span class="input-group-text">$</span>
                                                <input type="number" class="form-control" id="initial-balance" min="0" step="0.01" required>
                                            </div>
                                        </div>
                                        <button type="submit" class="btn btn-primary w-100" id="add-custom-account-btn">
                                            <i class="fas fa-plus me-2"></i>Add Custom Account
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get reference to the newly created modal
        const modalElement = document.getElementById('bank-connection-modal');

        // Add event listener to the complete button
        const completeButton = modalElement.querySelector('#complete-mock-connection');
        if (completeButton) {
            completeButton.addEventListener('click', handleMockConnection);
        }

        // Add event listener to the custom account form
        const customAccountForm = modalElement.querySelector('#custom-bank-form');
        if (customAccountForm) {
            customAccountForm.addEventListener('submit', function (e) {
                e.preventDefault();
                handleCustomAccountAddition();
            });
        }

        return modalElement;
    } catch (error) {
        return null;
    }
}

// Handle adding a custom bank account
async function handleCustomAccountAddition() {


    try {
        // Get form values
        const bankName = document.getElementById('bank-name').value;
        const accountType = document.getElementById('account-type').value;
        const accountNumber = document.getElementById('account-number').value;
        const initialBalance = parseFloat(document.getElementById('initial-balance').value);

        // Create new bank account object
        const newAccount = {
            id: 'acc-' + Math.random().toString(36).substring(2, 9),
            bankName: bankName,
            accountType: accountType,
            accountNumber: `xxxx-xxxx-xxxx-${accountNumber}`,
            balance: initialBalance,
            addedOn: new Date().toISOString()
        };

        // Get existing accounts (or initialize empty array)
        const accounts = JSON.parse(localStorage.getItem('bankAccounts') || '[]');
        accounts.push(newAccount);

        // Save to localStorage
        localStorage.setItem('bankAccounts', JSON.stringify(accounts));

        // Create an initial deposit transaction

        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);

            // Map Firestore docs to Expense[]
            const transactions = snapshot.docs.map(doc => doc.data());

            // Add initial balance as a transaction
            transactions.push({
                id: 'tx-' + Math.random().toString(36).substring(2, 9),
                date: new Date().toISOString(),
                description: 'Initial Balance',
                amount: initialBalance.toString(),
                category: 'Deposit',
                merchant: bankName,
                accountName: getAccountTypeName(accountType) + ` (${accountNumber})`,
                accountId: newAccount.id
            });

            // Save transactions
            localStorage.setItem('bankTransactions', JSON.stringify(transactions));

            // Close the modal
            // const modal = Modal.getInstance(document.getElementById('bank-connection-modal'));

            // if (modal) modal.hide();

            // Show success message
            showToast(`${bankName} account ending in ${accountNumber} has been added successfully!`, 'success');

            // Update the UI
            displayTransactionSummary();
            updateBankConnectionsDisplay();
        })
    } catch (error) {
        showToast('An error occurred while adding your bank account. Please try again.', 'danger');
    }
}

// Handle mock bank connection
async function handleMockConnection() {

    const { default: Modal } = await import('bootstrap/js/dist/modal');

    try {
        // Reset mock data
        initializeMockData(true);

        // Close the modal
        const modal = Modal.getInstance(document.getElementById('bank-connection-modal'));
        if (modal) modal.hide();

        // Show success message
        showToast('Bank connected successfully! Transaction data has been imported.', 'success');

        // Update the UI
        displayTransactionSummary();
        updateBankConnectionsDisplay();
    } catch (error) {
        showToast('An error occurred while connecting to your bank. Please try again.', 'danger');
    }
}

// Update bank connections display
export function updateBankConnectionsDisplay() {

    try {
        const noConnectionsMsg = document.getElementById('no-connections-message');
        const connectionsList = document.getElementById('dashboard-connections-list');

        if (!noConnectionsMsg || !connectionsList) {
            console.log('Bank connection display elements not found', 'warn');
            return;
        }

        // Get all bank accounts
        const accounts = JSON.parse(localStorage.getItem('bankAccounts') || '[]');

        // Check if we have transactions, even without explicit accounts
        const hasTransactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]').length > 0;

        if (accounts.length === 0 && !hasTransactions) {
            // No accounts or transactions, show no connections message
            noConnectionsMsg.style.display = 'block';
            connectionsList.style.display = 'none';
            connectionsList.innerHTML = '';
            return;
        }

        // Show connections list, hide no connections message
        noConnectionsMsg.style.display = 'none';
        connectionsList.style.display = 'block';

        let connectionsHTML = '';

        // Add default mock connection if we have transactions but no accounts
        if (hasTransactions && accounts.length === 0) {
            connectionsHTML += `
                <div class="bank-connection-item">
                    <div class="d-flex align-items-center">
                        <img src="https://cdn.jsdelivr.net/gh/transferwise/currency-flags/master/src/flags/au.png" class="bank-logo" alt="Bank Logo">
                        <div class="bank-info">
                            <div class="bank-name">Commonwealth Bank</div>
                            <div class="bank-status success">Connected</div>
                        </div>
                    </div>
                    <div class="bank-actions">
                        <button type="button" title="Refresh" onclick="alert('Refreshing data is disabled in this demo')">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button type="button" title="Disconnect" onclick="alert('Disconnecting is disabled in this demo')">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        // Add custom accounts
        accounts.forEach(account => {
            // Determine flag icon based on bank name (simplified demo approach)
            let flagCode = 'us'; // Default flag
            if (account.bankName.toLowerCase().includes('commonwealth')) flagCode = 'au';
            else if (account.bankName.toLowerCase().includes('royal')) flagCode = 'ca';
            else if (account.bankName.toLowerCase().includes('barclays')) flagCode = 'gb';

            // Get account type display name
            const accountTypeName = getAccountTypeName(account.accountType);

            // Get last 4 digits
            const lastFourDigits = account.accountNumber.slice(-4);

            connectionsHTML += `
                <div class="bank-connection-item" data-account-id="${account.id}">
                    <div class="d-flex align-items-center">
                        <img src="https://cdn.jsdelivr.net/gh/transferwise/currency-flags/master/src/flags/${flagCode}.png" class="bank-logo" alt="Bank Logo">
                        <div class="bank-info">
                            <div class="bank-name">${account.bankName}</div>
                            <div class="account-details text-muted small">${accountTypeName} ending in ${lastFourDigits}</div>
                            <div class="bank-status success">Connected</div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center">
                        <div class="account-balance me-3">
                            <div class="text-muted small">Balance</div>
                            <div class="fw-bold">${formatCurrency(account.balance)}</div>
                        </div>
                        <div class="bank-actions">
                            <button type="button" title="Refresh" onclick="alert('Refreshing data is disabled in this demo')">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <button type="button" title="Disconnect" onclick="alert('Disconnecting is disabled in this demo')">
                                <i class="fas fa-unlink"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        // Update the list
        connectionsList.innerHTML = connectionsHTML;

    } catch (error) {
    }
}

// Helper to get account type display name
function getAccountTypeName(accountType) {
    const types = {
        checking: 'Checking Account',
        savings: 'Savings Account',
        credit: 'Credit Card',
        investment: 'Investment Account'
    };
    return types[accountType] || 'Account';
}




export async function openBankAccountsModal() {

    try {
        // Get or create modal element
        let modalElement = document.getElementById('bank-accounts-modal');
        const { default: Modal } = await import('bootstrap/js/dist/modal');

        // If modal doesn't exist, create it
        if (!modalElement) {
            modalElement = document.createElement('div');
            modalElement.id = 'bank-accounts-modal';
            modalElement.className = 'modal fade';
            modalElement.setAttribute('tabindex', '-1');
            modalElement.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-university text-success me-2"></i>Your Bank Accounts
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="bank-accounts-container">
                                <div class="text-center p-5" id="bank-accounts-loading">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-3">Loading bank accounts...</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" id="add-new-bank-btn">
                                <i class="fas fa-plus me-1"></i>Add Bank Account
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalElement);

            // Add event listener for the add new bank button
            const addNewBankBtn = document.getElementById('add-new-bank-btn');
            if (addNewBankBtn) {
                addNewBankBtn.addEventListener('click', function () {

                    // Close this modal and open the bank connection modal
                    const currentModal = Modal.getInstance(modalElement);
                    if (currentModal) currentModal.hide();
                    setTimeout(() => openBankConnectionModal(), 400);
                });
            }
        }

        // Show the modal
        const modal = new Modal(modalElement);

        modalElement.addEventListener(
            'hidden.bs.modal',
            () => {
                // Delay removal slightly to allow Bootstrap to remove modal-open, backdrop, etc.
                setTimeout(() => {
                    modal.dispose();           // clean up modal instance
                    modalElement.remove();     // remove modal DOM element

                    // ✅ Manually ensure body is scrollable again
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                }, 100); // 100ms is safe buffer
            },
            { once: true }
        );


        // Load bank accounts data after modal is shown
        modalElement.addEventListener('shown.bs.modal', function () {
            loadBankAccountsContent(modalElement);
        }, { once: true });

        modal.show();

    } catch (error) {
        showToast('An error occurred while opening the bank accounts. Please refresh the page.', 'danger');
    }
}

// Load bank accounts content
function loadBankAccountsContent(modalElement) {

    try {
        const accountsContainer = modalElement.querySelector('#bank-accounts-container');
        const loadingIndicator = modalElement.querySelector('#bank-accounts-loading');

        if (!accountsContainer) {
            console.log('Bank accounts container not found', 'error');
            return;
        }

        // Get accounts from localStorage
        const accounts = JSON.parse(localStorage.getItem('bankAccounts') || '[]');

        // Check if we have transactions, even without explicit accounts
        const hasTransactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]').length > 0;

        // Hide loading indicator
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        if (accounts.length === 0 && !hasTransactions) {
            // No accounts or transactions
            accountsContainer.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-university fa-3x text-muted mb-3"></i>
                    <p>No bank accounts connected yet. Click "Add Bank Account" to get started.</p>
                </div>
            `;
            return;
        }

        let accountsHTML = `
            <div class="mb-4">
                <h6 class="mb-3">Connected Accounts</h6>
            </div>
        `;

        // Add default mock connection if we have transactions but no accounts
        if (hasTransactions && accounts.length === 0) {
            accountsHTML += `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <div class="me-3">
                                    <img src="https://cdn.jsdelivr.net/gh/transferwise/currency-flags/master/src/flags/au.png" width="32" alt="Bank Logo" class="rounded">
                                </div>
                                <div>
                                    <h6 class="mb-0">Commonwealth Bank</h6>
                                    <span class="text-muted small">Checking Account ending in 1234</span>
                                    <div><span class="badge bg-success">Connected</span></div>
                                </div>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold">$2,548.32</div>
                                <div class="small text-muted">Current Balance</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Add custom accounts
        accounts.forEach(account => {
            // Determine flag icon based on bank name (simplified demo approach)
            let flagCode = 'us'; // Default flag
            if (account.bankName.toLowerCase().includes('commonwealth')) flagCode = 'au';
            else if (account.bankName.toLowerCase().includes('royal')) flagCode = 'ca';
            else if (account.bankName.toLowerCase().includes('barclays')) flagCode = 'gb';

            // Get account type display name
            const accountTypeName = getAccountTypeName(account.accountType);

            // Get last 4 digits
            const lastFourDigits = account.accountNumber.slice(-4);

            accountsHTML += `
                <div class="card mb-3" data-account-id="${account.id}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <div class="me-3">
                                    <img src="https://cdn.jsdelivr.net/gh/transferwise/currency-flags/master/src/flags/${flagCode}.png" width="32" alt="Bank Logo" class="rounded">
                                </div>
                                <div>
                                    <h6 class="mb-0">${account.bankName}</h6>
                                    <span class="text-muted small">${accountTypeName} ending in ${lastFourDigits}</span>
                                    <div><span class="badge bg-success">Connected</span></div>
                                </div>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold">${formatCurrency(account.balance)}</div>
                                <div class="small text-muted">Current Balance</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Add tip for more accounts
        accountsHTML += `
            <div class="alert alert-light border mt-3">
                <div class="d-flex">
                    <div class="me-3">
                        <i class="fas fa-lightbulb text-warning"></i>
                    </div>
                    <div>
                        <span class="small">
                            Connect multiple accounts to get a comprehensive view of your finances.
                            Click "Add Bank Account" to connect more accounts.
                        </span>
                    </div>
                </div>
            </div>
        `;

        // Update container with accounts
        accountsContainer.innerHTML = accountsHTML;

    } catch (error) {
        if (modalElement) {
            modalElement.querySelector('#bank-accounts-container').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    An error occurred while loading bank accounts. Please try again.
                </div>
            `;
        }
    }
}

// subscription functions 

// Open subscriptions modal
async function openSubscriptionsModal() {

    try {
        const { default: Modal } = await import('bootstrap/js/dist/modal');
        // Get modal element
        let modalElement = document.getElementById('subscriptions-modal');

        // Show the modal
        const modal = new Modal(modalElement);
        modal.show();

        // Load subscriptions data
        loadSubscriptionsData();

        // Set up add subscription form handlers
        setupSubscriptionFormHandlers();


    } catch (error) {
        showToast('An error occurred while opening the subscriptions. Please refresh the page.', 'danger');
    }
}

// Set up subscription form handlers
export function setupSubscriptionFormHandlers() {

    try {
        // Add subscription button
        const addButton = document.getElementById('add-subscription-btn');
        if (addButton) {
            addButton.addEventListener('click', function () {
                document.getElementById('add-subscription-form').style.display = 'block';
                this.style.display = 'none';

                // Set today's date in the date fields
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('subscription-start-date').value = today;
                document.getElementById('subscription-next-payment').value = today;
            });
        }

        // Close form button
        const closeButton = document.getElementById('close-subscription-form');
        if (closeButton) {
            closeButton.addEventListener('click', function () {
                document.getElementById('add-subscription-form').style.display = 'none';
                document.getElementById('add-subscription-btn').style.display = 'block';
            });
        }

        // Cancel button
        // const cancelButton = document.getElementById('cancel-subscription-btn');
        // debugger
        // if (cancelButton) {
        //     cancelButton.addEventListener('click', function () {
        //         document.getElementById('add-subscription-form').style.display = 'none';
        //         document.getElementById('add-subscription-btn').style.display = 'block';
        //         document.getElementById('subscription-form').reset();
        //     });
        // }

        // Form submission
        const form = document.getElementById('subscription-form');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                saveSubscription();
            });
        }

        // Scan for subscriptions button
        const scanButton = document.getElementById('scan-for-subscriptions-btn');
        if (scanButton) {
            scanButton.addEventListener('click', function () {
                // Pass true to forceScan to override auto-scan settings
                scanForSubscriptions(true);
            });
        }

    } catch (error) {
        console.log(`Error setting up subscription form handlers: ${error.message}`, 'error');
    }
}

// Check if automatic subscription scanning is enabled
function shouldAutoScanSubscriptions() {
    const autoScanEnabled = localStorage.getItem('autoScanSubscriptionsEnabled')
    return autoScanEnabled
}

// Scan for potential subscriptions in transactions
async function scanForSubscriptions(forceScan = false) {
    try {
        if (!forceScan && !shouldAutoScanSubscriptions()) return;


        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'bankTransactions'),
                where('userId', '==', user?.uid)
            );

            const r = query(
                collection(db, 'subscriptions'),
                where('userId', '==', user?.uid)
            );


            const txSnapshot = await getDocs(q);
            // const txSnapshot = await getDocs(collection(db, 'bankTransactions'));
            const transactions = txSnapshot.docs.map(doc => doc.data());
            const subSnapshot = await getDocs(r);
            const subscriptions = subSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const existingMerchants = subscriptions.map(sub => (sub.name || '').toLowerCase().trim());

            const merchantTransactions = {};

            transactions
                .filter(tx => parseFloat(tx.amount) < 0)
                .forEach(tx => {
                    const merchant = tx.merchant || 'Unknown';
                    const amount = Math.abs(parseFloat(tx.amount)).toFixed(2);
                    const key = `${merchant.toLowerCase()}_${amount}`;

                    if (!merchantTransactions[key]) merchantTransactions[key] = [];
                    merchantTransactions[key].push({ ...tx, date: new Date(tx.date) });
                });

            let added = 0;

            for (const [key, txs] of Object.entries(merchantTransactions)) {
                if (txs.length < 2) continue;

                txs.sort((a, b) => a.date - b.date);

                let totalDays = 0;
                let intervals = 0;
                for (let i = 1; i < txs.length; i++) {
                    const days = Math.round((txs[i].date - txs[i - 1].date) / (1000 * 60 * 60 * 24));
                    if (days > 5) {
                        totalDays += days;
                        intervals++;
                    }
                }

                if (intervals === 0) continue;

                const avgDays = totalDays / intervals;
                let frequency = 'monthly';
                if (avgDays <= 10) frequency = 'weekly';
                else if (avgDays >= 75 && avgDays <= 105) frequency = 'quarterly';
                else if (avgDays >= 350) frequency = 'yearly';

                const [merchantName] = key.split('_');
                if (existingMerchants.includes(merchantName)) continue;
                const user = auth.currentUser;

                const subscription = {
                    id: 'sub-' + Math.random().toString(36).substring(2, 9),
                    name: merchantName.charAt(0).toUpperCase() + merchantName.slice(1),
                    amount: txs[0].amount,
                    category: txs[0].category || 'Entertainment',
                    frequency,
                    startDate: txs[0].date.toISOString().split('T')[0],
                    nextPaymentDate: calculateNextPaymentDate(txs[txs.length - 1].date, avgDays).toISOString().split('T')[0],
                    notes: `Auto-detected from ${txs.length} transactions. Avg interval: ${Math.round(avgDays)} days.`,
                    autoDetected: true,
                    createdAt: new Date().toISOString(),
                    userId: user.uid,
                };

                await addDoc(collection(db, 'subscriptions'), subscription);
                added++;
            }

            if (added > 0) {
                showToast(`Added ${added} new subscription${added > 1 ? 's' : ''}`, 'success');
                loadSubscriptionsData(); // Refresh view
            } else {
                showToast('No new subscriptions detected.', 'info');
            }
        })
    } catch (err) {
        console.error(err);
        showToast('Error during subscription scan.', 'danger');
    }
}


// Load subscriptions data
export async function loadSubscriptionsData() {

    try {
        // Get subscriptions from localStorage
        // const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                console.error('No authenticated user found. Cannot fetch user-specific data.');
                return;
            }

            const q = query(
                collection(db, 'subscriptions'),
                where('userId', '==', user?.uid)
            );


            const snapshot = await getDocs(q);
            const subscriptions = snapshot.docs.map(doc => ({
                docId: doc.id, // ✅ Actual Firestore doc ID
                ...doc.data()
            }));

            // Update dashboard display
            updateSubscriptionDisplays(subscriptions);

            // Show/hide no subscriptions message
            const noSubscriptionsMessage = document.getElementById('no-subscriptions-message');
            const subscriptionsContainer = document.getElementById('subscriptions-container');

            if (subscriptions.length === 0) {
                noSubscriptionsMessage.style.display = 'block';
                subscriptionsContainer.innerHTML = '';
                return;
            }

            noSubscriptionsMessage.style.display = 'none';

            // Generate HTML for subscriptions
            let subscriptionsHTML = '';

            subscriptions.forEach((subscription, index) => {
                // Calculate monthly cost based on frequency
                let monthlyCost = parseFloat(subscription.amount);
                switch (subscription.frequency) {
                    case 'yearly':
                        monthlyCost = monthlyCost / 12;
                        break;
                    case 'quarterly':
                        monthlyCost = monthlyCost / 3;
                        break;
                    case 'weekly':
                        monthlyCost = monthlyCost * 4.33; // Average weeks in a month
                        break;
                }

                // Format dates
                const startDate = new Date(subscription.startDate);
                const nextPayment = new Date(subscription.nextPaymentDate);

                // Calculate days until next payment
                const today = new Date();
                const daysUntilPayment = Math.ceil((nextPayment - today) / (1000 * 60 * 60 * 24));
                let paymentStatus = '';

                if (daysUntilPayment < 0) {
                    paymentStatus = '<span class="badge bg-danger">Overdue</span>';
                } else if (daysUntilPayment <= 3) {
                    paymentStatus = '<span class="badge bg-warning text-dark">Due soon</span>';
                } else {
                    paymentStatus = `<span class="badge bg-success">In ${daysUntilPayment} days</span>`;
                }

                // Create subscription card
                subscriptionsHTML += `
                <div class="card mb-3 subscription-card" data-subscription-id="${subscription.id}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="mb-1">${subscription.name}</h5>
                                <span class="badge bg-light text-dark">${subscription.category}</span>
                                <span class="badge bg-light text-dark text-capitalize">${subscription.frequency}</span>
                            </div>
                            <h4 class="text-primary mb-0">${formatCurrency(subscription.amount)}</h4>
                        </div>
                        <div class="row mt-3">
                            <div class="col-md-4">
                                <div class="text-muted small">Started on</div>
                                <div>${startDate.toLocaleDateString()}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Next payment</div>
                                <div>${nextPayment.toLocaleDateString()}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Status</div>
                                <div>${paymentStatus}</div>
                            </div>
                        </div>
                        <div class="mt-3 d-flex justify-content-between align-items-center">
                            <div class="text-muted small">
                                ${subscription.notes ? `Note: ${subscription.notes}` : ''}
                            </div>
                            <div>
                                <button class="btn btn-sm btn-outline-danger delete-subscription-btn" data-subscription-index="${subscription.docId}">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                               <button class="btn btn-sm btn-outline-primary edit-subscription-btn ms-1" data-subscription-id="${subscription.docId}">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            });

            // Update container
            subscriptionsContainer.innerHTML = subscriptionsHTML;

            // Add event listeners for edit and delete buttons
            document.querySelectorAll('.edit-subscription-btn').forEach(button => {
                button.addEventListener('click', function () {
                    const docId = this.getAttribute('data-subscription-id');
                    editSubscription(docId);
                });
            });
            document.querySelectorAll('.delete-subscription-btn').forEach(button => {
                button.addEventListener('click', function () {
                    const docId = this.getAttribute('data-subscription-index')

                    deleteSubscription(docId);
                });
            });
        })
    } catch (error) {
        console.log(`Error loading subscriptions data: ${error.message}`, 'error');
    }
}

// Delete subscription
async function deleteSubscription(docId) {

    try {
        await deleteDoc(doc(db, "subscriptions", docId));
        showToast(`Subscription deleted`, 'success');
        loadSubscriptionsData();
    } catch (err) {
        console.error(err);
        showToast('Error deleting subscription', 'danger');
    }
}


// Edit subscription by ID (Firestore version)
async function editSubscription(docId) {
    const saveBtn = document.querySelector('#subscription-form button[type="submit"]');
    const originalBtnText = saveBtn ? saveBtn.innerHTML : '';
    let isSubmitting = false;
    try {
        const docRef = doc(db, 'subscriptions', docId); // ✅ Now using correct Firestore document ID
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            showToast('Subscription not found', 'warning');
            return;
        }

        const subscription = docSnap.data();

        // Populate form
        document.getElementById('subscription-name').value = subscription.name;
        document.getElementById('subscription-amount').value = subscription.amount;
        document.getElementById('subscription-category').value = subscription.category;
        document.getElementById('subscription-frequency').value = subscription.frequency;
        document.getElementById('subscription-start-date').value = subscription.startDate;
        document.getElementById('subscription-next-payment').value = subscription.nextPaymentDate;
        document.getElementById('subscription-notes').value = subscription.notes || '';

        document.getElementById('add-subscription-form').style.display = 'block';
        document.getElementById('add-subscription-btn').style.display = 'none';

        const form = document.getElementById('subscription-form');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async function handleUpdate(e) {


            if (isSubmitting) return; // Prevent double submission
            isSubmitting = true;



            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Saving...
        `;
            }

            e.preventDefault();

            const updatedData = {
                name: document.getElementById('subscription-name').value,
                amount: document.getElementById('subscription-amount').value,
                category: document.getElementById('subscription-category').value,
                frequency: document.getElementById('subscription-frequency').value,
                startDate: document.getElementById('subscription-start-date').value,
                nextPaymentDate: document.getElementById('subscription-next-payment').value,
                notes: document.getElementById('subscription-notes').value || '',
            };

            await updateDoc(doc(db, 'subscriptions', docId), updatedData);

            newForm.reset();
            document.getElementById('add-subscription-form').style.display = 'none';
            document.getElementById('add-subscription-btn').style.display = 'block';

            loadSubscriptionsData();
            showToast(`Subscription updated successfully`, 'success');
        });

    } catch (error) {
        console.error('Edit error:', error);
        showToast('An error occurred while editing the subscription.', 'danger');
    } finally {
        // Always reset button and state
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }
        isSubmitting = false;
    }
}


// Save subscription data
async function saveSubscription() {
    let isSubmitting = false;
    if (isSubmitting) return; // Prevent double submission
    isSubmitting = true;
    const saveBtn = document.querySelector('#subscription-form button[type="submit"]');
    const originalBtnText = saveBtn ? saveBtn.innerHTML : '';

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Saving...
        `;
    }
    try {
        const name = document.getElementById('subscription-name').value;
        const amount = document.getElementById('subscription-amount').value;
        const category = document.getElementById('subscription-category').value;
        const frequency = document.getElementById('subscription-frequency').value;
        const startDate = document.getElementById('subscription-start-date').value;
        const nextPaymentDate = document.getElementById('subscription-next-payment').value;
        const notes = document.getElementById('subscription-notes').value;
        const user = auth.currentUser;

        const subscription = {
            id: 'sub-' + Math.random().toString(36).substring(2, 9), // Store the ID in the document
            name,
            amount,
            category,
            frequency,
            startDate,
            nextPaymentDate,
            notes,
            autoDetected: false,
            userId: user.uid,
            createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'subscriptions'), subscription);

        showToast(`Subscription added successfully`, 'success');

        loadSubscriptionsData();
        document.getElementById('subscription-form').reset();
        document.getElementById('add-subscription-form').style.display = 'none';
        document.getElementById('add-subscription-btn').style.display = 'block';

    } catch (error) {
        console.error(error);
        showToast('An error occurred while saving the subscription', 'danger');
    } finally {
        // Always reset button and state
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }
        isSubmitting = false;
    }
}
// Update subscription displays across the app
export function updateSubscriptionDisplays(subscriptions) {

    try {
        // Calculate total monthly cost
        let totalMonthlyCost = 0;

        subscriptions.forEach(subscription => {
            let amount = parseFloat(subscription.amount || 0);
            if (isNaN(amount)) amount = 0;

            // Convert to monthly equivalent
            switch (subscription.frequency) {
                case 'yearly':
                    amount = amount / 12;
                    break;
                case 'quarterly':
                    amount = amount / 3;
                    break;
                case 'weekly':
                    amount = amount * 4.33; // Average weeks in a month
                    break;
            }

            totalMonthlyCost += amount;
        });


        // Update dashboard card - Direct update to prevent double $ signs
        const totalSubscriptionsElement = document.getElementById('total-subscriptions-value');
        if (totalSubscriptionsElement) {
            totalSubscriptionsElement.textContent = parseFloat(totalMonthlyCost).toFixed(2);
        } else {
        }

        // Also update the subscription count
        const subscriptionCountElement = document.getElementById('subscription-count');
        if (subscriptionCountElement) {
            subscriptionCountElement.textContent = subscriptions.length;
        }

        // Update modal value
        const modalTotalElement = document.getElementById('modal-total-subscriptions-value');
        if (modalTotalElement) {
            modalTotalElement.textContent = formatCurrency(totalMonthlyCost);
        }

    } catch (error) {
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
        const goalsCard = document.getElementById('goals-card');
        if (goalsCard && !goalsCard._hasGoalsClickHandler) {
            goalsCard.addEventListener('click', function () {

                openGoalsModal();
            });
            goalsCard._hasGoalsClickHandler = true;
        } else {
        }

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
        const subscriptionsCard = document.getElementById('subscriptions-card');
        if (subscriptionsCard && !subscriptionsCard._hasSubscriptionsClickHandler) {
            subscriptionsCard.addEventListener('click', function () {

                openSubscriptionsModal()
            });
            subscriptionsCard._hasSubscriptionsClickHandler = true;
        } else {
        }

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
                // Close the detailed modal
                try {
                    const { default: Modal } = await import('bootstrap/js/dist/modal');

                    const detailedModal = Modal.getInstance(document.getElementById('detailed-expenses-modal'));
                    if (detailedModal) detailedModal.hide();

                    // Open the categories modal
                    setTimeout(() => openExpenseCategoriesModal(), 400);
                } catch (error) {
                    console.error('Failed to open modal:', error);
                    viewExpenseCategoriesBtn.disabled = false;
                }
            });
        }


        // const viewExpenseCategoriesBtn = document.getElementById('view-expense-categories-btn');


        // if (viewExpenseCategoriesBtn) {
        //   viewExpenseCategoriesBtn.addEventListener('click', async function () {
        //     // Prevent multiple rapid clicks
        //     viewExpenseCategoriesBtn.disabled = true;

        //     try {
        //       const { default: Modal } = await import('bootstrap/js/dist/modal');

        //       const modalElement = document.getElementById('detailed-expenses-modal');
        //       if (modalElement) {
        //         const detailedModal = Modal.getInstance(modalElement);
        //         if (detailedModal) detailedModal.hide();
        //       }

        //       // Open the categories modal after a short delay
        //       setTimeout(() => {
        //         openExpenseCategoriesModal();

        //         // Re-enable the button after modal is fully rendered
        //         setTimeout(() => {
        //           viewExpenseCategoriesBtn.disabled = false;
        //         }, 600); // adjust to match Bootstrap modal animation duration
        //       }, 400);
        //     } catch (error) {
        //       console.error('Failed to open modal:', error);
        //       viewExpenseCategoriesBtn.disabled = false;
        //     }
        //   });
        // }


        document.getElementById('auto-detect-subscriptions')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            localStorage.setItem('autoScanSubscriptionsEnabled', checked ? 'true' : 'false');
        });



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

        // // Set up balance modal navigation buttons
        const viewAllIncomeFromBalanceBtn = document.getElementById('view-all-income-from-balance-btn');
        if (viewAllIncomeFromBalanceBtn) {

            viewAllIncomeFromBalanceBtn.addEventListener('click', async function () {
                const { default: Modal } = await import('bootstrap/js/dist/modal');

                // Close the balance modal
                const balanceModal = Modal.getInstance(document.getElementById('net-balance-modal'));
                if (balanceModal) balanceModal.hide();

                // Open the income modal
                setTimeout(() => openNetIncomeModal(), 400);
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
        const bankAccountsNavLink = document.getElementById('bank-accounts-nav-link');
        if (bankAccountsNavLink && !bankAccountsNavLink._hasBankAccountsClickHandler) {
            bankAccountsNavLink.addEventListener('click', function (e) {
                e.preventDefault();
                // log('Bank Accounts nav link clicked');
                openBankAccountsModal();
            });
            bankAccountsNavLink._hasBankAccountsClickHandler = true;
        } else {
        }

    } catch (error) {
    }
}

// utils/showToast.ts (TypeScript-safe)
export const showToast = (message, type = 'primary') => {
    if (typeof window === 'undefined') return;

    const toastEl = document.getElementById('main-toast');
    const toastBody = document.getElementById('toast-body');

    if (!toastEl || !toastBody) {
        console.error('Toast elements not found in DOM.');
        return;
    }

    // Set toast body content
    toastBody.textContent = message;

    // Update toast background class
    toastEl.className = `toast align-items-center text-white bg-${type} border-0 position-fixed top-0 end-0 m-3`;

    import('bootstrap/js/dist/toast')
        .then(({ default: Toast }) => {
            const toast = Toast.getOrCreateInstance(toastEl, {
                autohide: true,
                delay: 3000,
            });
            toast.show();
        })
        .catch((err) => {
            console.error('Failed to load Bootstrap Toast module:', err);
        });
};


function populateFormWithReceiptData(data) {

    const doc = data.documents[0].data;
    document.getElementById('vendor_name').value = doc.merchant_name || '';
    document.getElementById('total_amount').value = doc.total_amount || '';
    document.getElementById('date').value = doc.date || '';

    // Save original data temporarily for later reference
    window.currentReceiptData = data;
}


function updateLocalStorageAndUI(newData) {

    const currentStats = JSON.parse(localStorage.getItem('receiptStats')) || {
        totalReceipts: 0,
        totalSpent: 0,
        matchedReceipts: 0
    };

    // Increment values
    currentStats.totalReceipts += 1;
    currentStats.totalSpent += parseFloat(newData.documents[0].data.total_amount || 0);
    if (newData.matched) {
        currentStats.matchedReceipts += 1;
    }

    // Store in localStorage
    localStorage.setItem('receiptStats', JSON.stringify(currentStats));

    // Update HTML
    updateReceiptDashboard(currentStats);
}

function updateReceiptDashboard(stats) {
    document.getElementById('total-receipts-count').textContent = stats.totalReceipts;
    document.getElementById('total-receipts-amount').textContent = `$${stats.totalSpent.toFixed(2)}`;
    document.getElementById('matched-receipts-count').textContent = stats.matchedReceipts;

    const average = stats.totalReceipts > 0 ? stats.totalSpent / stats.totalReceipts : 0;
    document.getElementById('average-receipt-amount').textContent = `$${average.toFixed(2)}`;
}


// Function to update tax profile summary on the dashboard
function updateTaxProfileSummary() {

    try {
        const taxProfileData = localStorage.getItem('taxProfileData');
        const noProfileMessage = document.getElementById('no-tax-profile-message');
        const summaryContent = document.getElementById('tax-profile-summary-content');

        if (!taxProfileData) {
            // No profile data exists
            if (noProfileMessage) noProfileMessage.style.display = 'block';
            if (summaryContent) summaryContent.style.display = 'none';
            return;
        }

        // Profile data exists, parse it
        const profile = JSON.parse(taxProfileData);

        // Hide no profile message and show summary
        if (noProfileMessage) noProfileMessage.style.display = 'none';
        if (summaryContent) summaryContent.style.display = 'block';

        // Update personal information
        if (profile.personalInfo) {
            const personalInfo = profile.personalInfo;

            // Name
            const fullName = `${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`.trim();
            document.getElementById('summary-full-name').textContent = fullName || '-';

            // TFN (masked for privacy)
            if (personalInfo.tfn) {
                const maskedTfn = personalInfo.tfn.replace(/\d(?=\d{4})/g, '*');
                document.getElementById('summary-tfn').textContent = maskedTfn;
            } else {
                document.getElementById('summary-tfn').textContent = '-';
            }

            // Filing Status
            document.getElementById('summary-filing-status').textContent = personalInfo.filingStatus || '-';

            // Dependents
            const dependentsCount = personalInfo.hasDependents ?
                (personalInfo.dependents ? personalInfo.dependents.length : 0) : 0;
            document.getElementById('summary-dependents').textContent =
                dependentsCount > 0 ? `${dependentsCount} dependent(s)` : 'None';
        }

        // Update financial summary

        // Income sources
        if (profile.income) {
            const income = profile.income;
            const employersCount = income.employers ? income.employers.length : 0;
            const otherIncomeSources = [
                income.interestIncome && 'Interest',
                income.dividendIncome && 'Dividends',
                income.trustIncome && 'Trust',
                income.rentalIncome && 'Rental',
                income.capitalGains && 'Capital Gains',
                income.foreignIncome && 'Foreign',
                income.businessIncome && 'Business',
                income.superIncome && 'Super',
                income.partnershipIncome && 'Partnership'
            ].filter(Boolean);

            const incomeSourcesText = employersCount > 0 ?
                `${employersCount} employer(s)` : 'No employment income';

            const additionalText = otherIncomeSources.length > 0 ?
                `, plus ${otherIncomeSources.length} other source(s)` : '';

            document.getElementById('summary-income-sources').textContent =
                incomeSourcesText + additionalText;
        }

        // Deductions
        if (profile.deductions) {
            const deductions = profile.deductions;
            const deductionTypes = [
                deductions.useCarForWork && 'Car',
                deductions.workClothing && 'Work clothing',
                deductions.homeOffice && 'Home office',
                deductions.selfEducation && 'Self-education',
                deductions.tools && 'Tools',
                deductions.donations && 'Donations',
                deductions.taxAgentFees && 'Tax agent fees'
            ].filter(Boolean);

            document.getElementById('summary-deductions').textContent =
                deductionTypes.length > 0 ?
                    `${deductionTypes.length} type(s)` : 'None claimed';
        }

        // HECS/HELP
        if (profile.hecs) {
            document.getElementById('summary-hecs').textContent =
                profile.hecs.hasHecs ? 'Yes' : 'No';
        }

    } catch (error) {
        // In case of error, just show the no profile message
        const noProfileMessage = document.getElementById('no-tax-profile-message');
        const summaryContent = document.getElementById('tax-profile-summary-content');

        if (noProfileMessage) noProfileMessage.style.display = 'block';
        if (summaryContent) summaryContent.style.display = 'none';
    }
}

// Initialize empty tax profile data
function initializeEmptyTaxProfile() {
    const emptyProfile = {
        personalInfo: {},
        income: {},
        deductions: {},
        taxOffsets: {},
        medicare: {},
        hecs: {},
        additionalInfo: {},
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('taxProfileData', JSON.stringify(emptyProfile));
}

// Load existing tax profile data into the form
function loadTaxProfileData() {
    try {
        const taxProfileData = JSON.parse(localStorage.getItem('taxProfileData'));
        if (!taxProfileData) return;

        // Populate form fields from the saved data
        // Personal Information
        if (taxProfileData.personalInfo) {
            const personalInfo = taxProfileData.personalInfo;

            // Basic Identification
            if (personalInfo.title) document.getElementById('title').value = personalInfo.title;
            if (personalInfo.familyName) document.getElementById('family-name').value = personalInfo.familyName;
            if (personalInfo.firstName) document.getElementById('first-given-name').value = personalInfo.firstName;
            if (personalInfo.otherNames) document.getElementById('other-given-names').value = personalInfo.otherNames;
            if (personalInfo.previousNames) document.getElementById('previous-names').value = personalInfo.previousNames;
            if (personalInfo.dateOfBirth) document.getElementById('date-of-birth').value = personalInfo.dateOfBirth;
            if (personalInfo.tfn) document.getElementById('tfn').value = personalInfo.tfn;
            if (personalInfo.abn) document.getElementById('abn').value = personalInfo.abn;

            // Contact Details
            if (personalInfo.residentialAddress) document.getElementById('residential-address').value = personalInfo.residentialAddress;
            if (personalInfo.postalAddress) document.getElementById('postal-address').value = personalInfo.postalAddress;
            if (personalInfo.email) document.getElementById('email').value = personalInfo.email;
            if (personalInfo.mobile) document.getElementById('mobile').value = personalInfo.mobile;
            if (personalInfo.alternativePhone) document.getElementById('alternative-phone').value = personalInfo.alternativePhone;

            // Filing Status
            if (personalInfo.residencyStatus) {
                if (personalInfo.residencyStatus === 'yes') {
                    document.getElementById('resident-yes').checked = true;
                } else {
                    document.getElementById('resident-no').checked = true;
                }
            }

            if (personalInfo.taxFreeThreshold) {
                if (personalInfo.taxFreeThreshold === 'yes') {
                    document.getElementById('threshold-yes').checked = true;
                } else {
                    document.getElementById('threshold-no').checked = true;
                }
            }

            // Spouse details
            if (personalInfo.hasSpouse) {
                document.getElementById('has-spouse').checked = true;
                toggleSpouseDetails();

                if (personalInfo.spouseName) document.getElementById('spouse-name').value = personalInfo.spouseName;
                if (personalInfo.spouseTfn) document.getElementById('spouse-tfn').value = personalInfo.spouseTfn;
                if (personalInfo.spouseIncome) document.getElementById('spouse-income').value = personalInfo.spouseIncome;

                if (personalInfo.spousePeriod) {
                    if (personalInfo.spousePeriod === 'full') {
                        document.getElementById('spouse-full').checked = true;
                    } else {
                        document.getElementById('spouse-partial').checked = true;
                    }
                }
            }

            // Dependent details
            if (personalInfo.hasDependents) {
                document.getElementById('has-dependents').checked = true;
                toggleDependentDetails();

                if (personalInfo.dependents && personalInfo.dependents.length > 0) {
                    personalInfo.dependents.forEach(dependent => addDependentToForm(dependent));
                }
            }

            // Bank account
            if (personalInfo.bankBsb) document.getElementById('bank-bsb').value = personalInfo.bankBsb;
            if (personalInfo.bankAccount) document.getElementById('bank-account').value = personalInfo.bankAccount;
            if (personalInfo.bankName) document.getElementById('bank-name').value = personalInfo.bankName;
        }

        // Income information
        if (taxProfileData.income) {
            const income = taxProfileData.income;

            // Employment Income
            if (income.employers && income.employers.length > 0) {
                income.employers.forEach(employer => addEmployerToForm(employer));
            }

            // Investment Income
            if (income.interestIncome) document.getElementById('interest-income').value = income.interestIncome;
            if (income.dividendIncome) document.getElementById('dividend-income').value = income.dividendIncome;
            if (income.trustIncome) document.getElementById('trust-income').value = income.trustIncome;
            if (income.rentalIncome) document.getElementById('rental-income').value = income.rentalIncome;
            if (income.capitalGains) document.getElementById('capital-gains').value = income.capitalGains;

            // Government Payments
            if (income.govtPaymentType) document.getElementById('govt-payment-type').value = income.govtPaymentType;
            if (income.govtPaymentAmount) document.getElementById('govt-payment-amount').value = income.govtPaymentAmount;
            if (income.govtPaymentTax) document.getElementById('govt-payment-tax').value = income.govtPaymentTax;

            // Other Income
            if (income.foreignIncome) document.getElementById('foreign-income').value = income.foreignIncome;
            if (income.businessIncome) document.getElementById('business-income').value = income.businessIncome;
            if (income.superIncome) document.getElementById('super-income').value = income.superIncome;
            if (income.partnershipIncome) document.getElementById('partnership-income').value = income.partnershipIncome;
        }

        // Deductions
        if (taxProfileData.deductions) {
            const deductions = taxProfileData.deductions;

            // Car Expenses
            if (deductions.useCarForWork) {
                document.getElementById('use-car-for-work').checked = true;
                toggleCarExpenseDetails();

                if (deductions.carMake) document.getElementById('car-make').value = deductions.carMake;
                if (deductions.carRegistration) document.getElementById('car-registration').value = deductions.carRegistration;
                if (deductions.carMethod) document.getElementById('car-method').value = deductions.carMethod;
                if (deductions.businessKm) document.getElementById('business-km').value = deductions.businessKm;
                if (deductions.carExpenses) document.getElementById('car-expenses').value = deductions.carExpenses;
            }

            // Other deduction sections would be populated here
        }

        // Other sections (tax offsets, medicare, hecs, additional info) would be populated here

    } catch (error) {
        showToast('Failed to load your tax profile data. Please try again.', 'danger');
    }
}



// Toggle spouse details visibility
function toggleSpouseDetails() {
    const hasSpouse = document.getElementById('has-spouse').checked;
    const spouseDetails = document.getElementById('spouse-details');

    if (hasSpouse) {
        spouseDetails.style.display = 'flex';
    } else {
        spouseDetails.style.display = 'none';
    }
}

// Toggle dependent details visibility
function toggleDependentDetails() {
    const hasDependents = document.getElementById('has-dependents').checked;
    const dependentDetails = document.getElementById('dependent-details');

    if (hasDependents) {
        dependentDetails.style.display = 'flex';
    } else {
        dependentDetails.style.display = 'none';
    }
}

// Toggle car expense details visibility
function toggleCarExpenseDetails() {
    const useCarForWork = document.getElementById('use-car-for-work').checked;
    const carExpenseDetails = document.getElementById('car-expense-details');

    if (useCarForWork) {
        carExpenseDetails.style.display = 'flex';
    } else {
        carExpenseDetails.style.display = 'none';
    }
}

// Add dependent to form
function addDependentToForm(dependent = null) {
    const dependentsContainer = document.getElementById('dependents-container');
    const dependentCount = dependentsContainer.querySelectorAll('.dependent-item').length + 1;

    const dependentDiv = document.createElement('div');
    dependentDiv.className = 'dependent-item card mb-3';
    dependentDiv.innerHTML = `
        <div class="card-header bg-light d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Dependent ${dependentCount}</h5>
            <button type="button" class="btn btn-sm btn-outline-danger remove-dependent">
                <i class="fas fa-times"></i> Remove
            </button>
        </div>
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Full Name</label>
                    <input type="text" class="form-control dependent-name" value="${dependent?.name || ''}" required>
                    <div class="invalid-feedback">Please enter dependent's name.</div>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Date of Birth</label>
                    <input type="date" class="form-control dependent-dob" value="${dependent?.dateOfBirth || ''}" required>
                    <div class="invalid-feedback">Please enter date of birth.</div>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Relationship</label>
                    <select class="form-select dependent-relationship" required>
                        <option value="" ${!dependent?.relationship ? 'selected' : ''}>Choose...</option>
                        <option value="child" ${dependent?.relationship === 'child' ? 'selected' : ''}>Child</option>
                        <option value="stepchild" ${dependent?.relationship === 'stepchild' ? 'selected' : ''}>Stepchild</option>
                        <option value="foster" ${dependent?.relationship === 'foster' ? 'selected' : ''}>Foster child</option>
                        <option value="other" ${dependent?.relationship === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                    <div class="invalid-feedback">Please select relationship.</div>
                </div>
            </div>
        </div>
    `;

    // Add remove handler
    const removeButton = dependentDiv.querySelector('.remove-dependent');
    removeButton.addEventListener('click', function () {
        dependentsContainer.removeChild(dependentDiv);
    });

    dependentsContainer.appendChild(dependentDiv);
}

// Add employer to form
function addEmployerToForm(employer = null) {
    const employersContainer = document.getElementById('employers-container');
    const employerCount = employersContainer.querySelectorAll('.employer-item').length + 1;

    const employerDiv = document.createElement('div');
    employerDiv.className = 'employer-item card mb-3';
    employerDiv.innerHTML = `
        <div class="card-header bg-light d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Employer ${employerCount}</h5>
            <button type="button" class="btn btn-sm btn-outline-danger remove-employer">
                <i class="fas fa-times"></i> Remove
            </button>
        </div>
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Employer Name</label>
                    <input type="text" class="form-control employer-name" value="${employer?.name || ''}" required>
                    <div class="invalid-feedback">Please enter employer name.</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label">ABN</label>
                    <input type="text" class="form-control employer-abn" value="${employer?.abn || ''}">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Occupation</label>
                    <input type="text" class="form-control employer-occupation" value="${employer?.occupation || ''}" required>
                    <div class="invalid-feedback">Please enter your occupation.</div>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Employment Type</label>
                    <select class="form-select employer-type" required>
                        <option value="" ${!employer?.employmentType ? 'selected' : ''}>Choose...</option>
                        <option value="full-time" ${employer?.employmentType === 'full-time' ? 'selected' : ''}>Full-time</option>
                        <option value="part-time" ${employer?.employmentType === 'part-time' ? 'selected' : ''}>Part-time</option>
                        <option value="casual" ${employer?.employmentType === 'casual' ? 'selected' : ''}>Casual</option>
                    </select>
                    <div class="invalid-feedback">Please select employment type.</div>
                </div>
                <div class="col-md-2">
                    <label class="form-label">Salary/Wages</label>
                    <input type="number" class="form-control employer-salary" min="0" step="0.01" value="${employer?.salary || ''}" required>
                    <div class="invalid-feedback">Please enter your salary.</div>
                </div>
                <div class="col-md-2">
                    <label class="form-label">Tax Withheld</label>
                    <input type="number" class="form-control employer-tax" min="0" step="0.01" value="${employer?.taxWithheld || ''}">
                </div>
            </div>
        </div>
    `;

    // Add remove handler
    const removeButton = employerDiv.querySelector('.remove-employer');
    removeButton.addEventListener('click', function () {
        employersContainer.removeChild(employerDiv);
    });

    employersContainer.appendChild(employerDiv);
}

// Validate the tax profile form
function validateTaxProfileForm() {

    // Get the form
    const form = document.getElementById('tax-profile-form');

    // Add bootstrap validation classes
    form.classList.add('was-validated');

    // Check if the form is valid
    if (!form.checkValidity()) {
        // Focus on first invalid field
        const firstInvalidField = form.querySelector(':invalid');
        if (firstInvalidField) {
            // Activate the tab containing the invalid field
            const tabPane = firstInvalidField.closest('.tab-pane');
            if (tabPane) {
                const tabId = tabPane.id.replace('-content', '-tab');
                const tab = document.getElementById(tabId);
                if (tab) {
                    tab.click();
                }
            }

            firstInvalidField.focus();
        }

        showToast('Please fill in all required fields correctly.', 'warning');
        return false;
    }

    return true;
}

// Collect data from dynamic employer fields
function collectEmployersData() {
    const employersData = [];
    const employerElements = document.querySelectorAll('.employer-item');

    employerElements.forEach(element => {
        const employer = {
            name: element.querySelector('.employer-name')?.value || '',
            abn: element.querySelector('.employer-abn')?.value || '',
            occupation: element.querySelector('.employer-occupation')?.value || '',
            employmentType: element.querySelector('.employer-type')?.value || '',
            salary: element.querySelector('.employer-salary')?.value || '',
            taxWithheld: element.querySelector('.employer-tax')?.value || ''
        };

        employersData.push(employer);
    });

    return employersData;
}

// Update saveTaxProfileData to update the dashboard summary
async function saveTaxProfileData() {

    try {
        const { default: Modal } = await import('bootstrap/js/dist/modal');


        // First validate the form
        if (!validateTaxProfileForm()) {
            return false;
        }

        // Collect data from the form
        const taxProfileData = {
            personalInfo: {
                // Basic Identification
                title: document.getElementById('title').value,
                familyName: document.getElementById('family-name').value,
                firstName: document.getElementById('first-given-name').value,
                otherNames: document.getElementById('other-given-names').value,
                previousNames: document.getElementById('previous-names').value,
                dateOfBirth: document.getElementById('date-of-birth').value,
                tfn: document.getElementById('tfn').value,
                abn: document.getElementById('abn').value,

                // Contact Details
                residentialAddress: document.getElementById('residential-address').value,
                postalAddress: document.getElementById('postal-address').value,
                email: document.getElementById('email').value,
                mobile: document.getElementById('mobile').value,
                alternativePhone: document.getElementById('alternative-phone').value,

                // Filing Status
                residencyStatus: document.querySelector('input[name="residency-status"]:checked')?.value,
                taxFreeThreshold: document.querySelector('input[name="tax-free-threshold"]:checked')?.value,

                // Spouse details
                hasSpouse: document.getElementById('has-spouse').checked,
                spouseName: document.getElementById('has-spouse').checked ? document.getElementById('spouse-name').value : '',
                spouseTfn: document.getElementById('has-spouse').checked ? document.getElementById('spouse-tfn').value : '',
                spouseIncome: document.getElementById('has-spouse').checked ? document.getElementById('spouse-income').value : '',
                spousePeriod: document.getElementById('has-spouse').checked ? document.querySelector('input[name="spouse-period"]:checked')?.value : '',

                // Dependent details
                hasDependents: document.getElementById('has-dependents').checked,
                dependents: document.getElementById('has-dependents').checked ? collectDependentsData() : [],

                // Bank account
                bankBsb: document.getElementById('bank-bsb').value,
                bankAccount: document.getElementById('bank-account').value,
                bankName: document.getElementById('bank-name').value
            },
            income: {
                // Employment Income
                employers: collectEmployersData(),

                // Investment Income
                interestIncome: document.getElementById('interest-income').value,
                dividendIncome: document.getElementById('dividend-income').value,
                trustIncome: document.getElementById('trust-income').value,
                rentalIncome: document.getElementById('rental-income').value,
                capitalGains: document.getElementById('capital-gains').value,

                // Government Payments
                govtPaymentType: document.getElementById('govt-payment-type').value,
                govtPaymentAmount: document.getElementById('govt-payment-amount').value,
                govtPaymentTax: document.getElementById('govt-payment-tax').value,

                // Other Income
                foreignIncome: document.getElementById('foreign-income').value,
                businessIncome: document.getElementById('business-income').value,
                superIncome: document.getElementById('super-income').value,
                partnershipIncome: document.getElementById('partnership-income').value
            },
            deductions: {
                // Car Expenses
                useCarForWork: document.getElementById('use-car-for-work').checked,
                carMake: document.getElementById('use-car-for-work').checked ? document.getElementById('car-make').value : '',
                carRegistration: document.getElementById('use-car-for-work').checked ? document.getElementById('car-registration').value : '',
                carMethod: document.getElementById('use-car-for-work').checked ? document.getElementById('car-method').value : '',
                businessKm: document.getElementById('use-car-for-work').checked ? document.getElementById('business-km').value : '',
                carExpenses: document.getElementById('use-car-for-work').checked ? document.getElementById('car-expenses').value : ''

                // Other deduction sections would be collected here
            },
            taxOffsets: {
                // Tax offset data would be collected here
            },
            medicare: {
                // Medicare data would be collected here
            },
            hecs: {
                // HECS/HELP data would be collected here
            },
            additionalInfo: {
                // Additional information would be collected here
            },
            lastUpdated: new Date().toISOString()
        };

        // Save to local storage
        localStorage.setItem('taxProfileData', JSON.stringify(taxProfileData));

        // Update dashboard summary
        updateTaxProfileSummary();

        // Show success message
        showToast('Your tax profile has been saved successfully!', 'success');

        // // Close the modal
        const modal = Modal.getInstance(document.getElementById('tax-profile-modal'));
        if (modal) {
            modal.hide();
        }

        return true;

    } catch (error) {

        showToast('Failed to save your tax profile. Please try again.', 'danger');
        return false;
    }
}

// Setup event listeners for the tax profile form
function setupTaxProfileForm() {

    // Spouse checkbox change
    const hasSpouseCheckbox = document.getElementById('has-spouse');
    if (hasSpouseCheckbox) {
        hasSpouseCheckbox.addEventListener('change', toggleSpouseDetails);
    }

    // Dependent checkbox change
    const hasDependentsCheckbox = document.getElementById('has-dependents');
    if (hasDependentsCheckbox) {
        hasDependentsCheckbox.addEventListener('change', toggleDependentDetails);
    }

    // Car expense checkbox change
    const useCarForWorkCheckbox = document.getElementById('use-car-for-work');
    if (useCarForWorkCheckbox) {
        useCarForWorkCheckbox.addEventListener('change', toggleCarExpenseDetails);
    }

    // Add employer button
    const addEmployerButton = document.getElementById('add-employer');
    if (addEmployerButton) {
        addEmployerButton.addEventListener('click', function () {
            addEmployerToForm();
        });
    }

    // Add dependent button
    const addDependentButton = document.getElementById('add-dependent');
    if (addDependentButton) {
        addDependentButton.addEventListener('click', function () {
            addDependentToForm();
        });
    }

    // Save tax profile button
    const saveTaxProfileButton = document.getElementById('save-tax-profile');
    if (saveTaxProfileButton) {
        saveTaxProfileButton.addEventListener('click', saveTaxProfileData);
    }
}


function setupDashboardTiles() {

    // Tax Profile card
    const taxProfileCard = document.getElementById('tax-profile-card');
    if (taxProfileCard) {
        taxProfileCard.addEventListener('click', function () {
            const taxProfileModal = new bootstrap.Modal(document.getElementById('tax-profile-modal'));
            taxProfileModal.show();

            // If no tax profile data exists yet, initialize with empty data
            if (!localStorage.getItem('taxProfileData')) {
                initializeEmptyTaxProfile();
            } else {
                // Load existing tax profile data
                loadTaxProfileData();
            }
        });
    }

    // Edit tax profile button
    const editTaxProfileBtn = document.getElementById('edit-tax-profile-btn');
    if (editTaxProfileBtn) {
        editTaxProfileBtn.addEventListener('click', function (e) {
            e.stopPropagation(); // Prevent the card click handler from firing

            const taxProfileModal = new bootstrap.Modal(document.getElementById('tax-profile-modal'));
            taxProfileModal.show();

            // Load existing tax profile data
            loadTaxProfileData();
        });
    }
}


export {
    generateMockTransactions,
    initializeMockData,
    formatCurrency,
    updateElementText,
    displayTransactionSummary,
    loadIncomeDetails,
    loadDetailedExpenses, setupExpenseSearch,
    openExpenseCategoriesModal,
    setupFinancialFeatureHandlers,
    openNetBalanceModal,
    openDetailedExpensesModal,
    populateFormWithReceiptData,
    updateReceiptDashboard,
    updateLocalStorageAndUI,
    loadDataDashboard,
    loadNetBalanceDetails,
    loadBankAccountsContent,
    handleCustomAccountAddition,
    handleMockConnection,
    setupBankConnectionHandlers,
    updateTaxProfileSummary,
    initializeEmptyTaxProfile,
    loadTaxProfileData,
    setupTaxProfileForm,
    setupDashboardTiles
}