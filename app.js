// GraphQL endpoint
const GRAPHQL_URL = '/graphql';

let editingTransactionId = null;
let charts = {
  incomeExpenses: null,
  category: null,
  balance: null,
  categoryTrend: null
};

// GraphQL query helper
async function graphqlQuery(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    
    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    
    return result.data;
  } catch (error) {
    console.error('GraphQL error:', error);
    throw error;
  }
}

// GraphQL Queries and Mutations
const GET_TRANSACTIONS_QUERY = `
  query GetTransactions($filters: TransactionFilters) {
    transactions(filters: $filters) {
      id
      type
      amount
      category
      date
      createdAt
    }
  }
`;

const GET_SUMMARY_QUERY = `
  query GetSummary($month: Int, $year: Int) {
    summary(month: $month, year: $year) {
      totalIncome
      totalExpenses
      balance
    }
  }
`;

const CREATE_TRANSACTION_MUTATION = `
  mutation CreateTransaction($input: TransactionInput!) {
    createTransaction(input: $input) {
      success
      error
      transaction {
        id
        type
        amount
        category
        date
        createdAt
      }
    }
  }
`;

const UPDATE_TRANSACTION_MUTATION = `
  mutation UpdateTransaction($id: Int!, $input: TransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      success
      error
      transaction {
        id
        type
        amount
        category
        date
        createdAt
      }
    }
  }
`;

const DELETE_TRANSACTION_MUTATION = `
  mutation DeleteTransaction($id: Int!) {
    deleteTransaction(id: $id) {
      success
      error
    }
  }
`;

const GET_INVESTMENTS_QUERY = `
  query {
    investments {
      bankBalance
      hysaBalance
      stockValue
      lastUpdated
    }
  }
`;

const GET_INVESTMENT_HISTORY_QUERY = `
  query {
    investmentHistory {
      date
      bankBalance
      hysaBalance
      stockValue
      netWorth
    }
  }
`;

const UPDATE_INVESTMENTS_MUTATION = `
  mutation UpdateInvestments($bankBalance: Float, $hysaBalance: Float, $stockValue: Float) {
    updateInvestments(bankBalance: $bankBalance, hysaBalance: $hysaBalance, stockValue: $stockValue) {
      success
      error
      investment {
        bankBalance
        hysaBalance
        stockValue
      }
    }
  }
`;

// Category icons mapping
const categoryIcons = {
  'Food': '🍔',
  'Rent': '🏠',
  'Travel': '✈️',
  'Misc': '📦'
};

// Set transaction type (for toggle buttons)
function setType(type) {
  document.getElementById('type').value = type;
  
  // Update toggle button styles
  const expenseBtn = document.getElementById('typeExpense');
  const incomeBtn = document.getElementById('typeIncome');
  
  expenseBtn.classList.remove('active');
  incomeBtn.classList.remove('active');
  
  if (type === 'expense') {
    expenseBtn.classList.add('active');
  } else {
    incomeBtn.classList.add('active');
  }
  
  updateCategoryVisibility();
}

// Show/hide category based on type
function updateCategoryVisibility() {
  const typeEl = document.getElementById('type');
  const groupEl = document.getElementById('categoryGroup');
  const categoryEl = document.getElementById('category');
  if (!typeEl || !groupEl || !categoryEl) return;
  if (typeEl.value === 'expense') {
    groupEl.style.display = '';
    categoryEl.required = true;
  } else {
    groupEl.style.display = 'none';
    categoryEl.required = false;
  }
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Fetch transactions using GraphQL
async function fetchTransactions() {
  try {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    
    const data = await graphqlQuery(GET_TRANSACTIONS_QUERY);
    const transactions = data.transactions || [];
    
    document.getElementById('loading').style.display = 'none';
    
    if (transactions.length === 0) {
      document.getElementById('emptyState').style.display = 'block';
      document.getElementById('transactionsList').innerHTML = '';
    } else {
      document.getElementById('emptyState').style.display = 'none';
      renderTransactions(transactions);
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
    document.getElementById('loading').style.display = 'none';
    alert('Failed to load transactions: ' + error.message);
  }
}

// Load investments
async function loadInvestments() {
  try {
    const data = await graphqlQuery(GET_INVESTMENTS_QUERY);
    const inv = data.investments;
    const netWorth = inv.bankBalance + inv.hysaBalance + inv.stockValue;

    document.getElementById('inv-bankBalance').textContent = formatCurrency(inv.bankBalance);
    document.getElementById('inv-hysaBalance').textContent = formatCurrency(inv.hysaBalance);
    document.getElementById('inv-stockValue').textContent = formatCurrency(inv.stockValue);

    const netEl = document.getElementById('inv-netWorth');
    netEl.textContent = formatCurrency(netWorth);
    netEl.className = `stat-value ${netWorth >= 0 ? 'income' : 'expense'}`;

    document.getElementById('bankBalanceInput').value = inv.bankBalance || '';
    document.getElementById('hysaBalanceInput').value = inv.hysaBalance || '';
    document.getElementById('stockValueInput').value = inv.stockValue || '';
  } catch (error) {
    console.error('Error loading investments:', error);
  }
}

// Save investment value
async function saveInvestment(type) {
  const variables = {};
  if (type === 'bank') {
    const val = parseFloat(document.getElementById('bankBalanceInput').value);
    if (isNaN(val) || val < 0) { alert('Please enter a valid amount.'); return; }
    variables.bankBalance = val;
  } else if (type === 'hysa') {
    const val = parseFloat(document.getElementById('hysaBalanceInput').value);
    if (isNaN(val) || val < 0) { alert('Please enter a valid amount.'); return; }
    variables.hysaBalance = val;
  } else {
    const val = parseFloat(document.getElementById('stockValueInput').value);
    if (isNaN(val) || val < 0) { alert('Please enter a valid amount.'); return; }
    variables.stockValue = val;
  }
  try {
    const data = await graphqlQuery(UPDATE_INVESTMENTS_MUTATION, variables);
    if (data.updateInvestments.success) {
      await loadInvestments();
    } else {
      alert(data.updateInvestments.error || 'Failed to update.');
    }
  } catch (error) {
    alert('Failed to update: ' + error.message);
  }
}

// Portfolio stats charts
let portfolioCharts = { netWorth: null, bank: null, hysa: null, stock: null };

function makeLineChart(ctx, label, data, labels, color) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + '1a',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#71717a' }, grid: { color: '#f4f4f5' } },
        y: {
          ticks: {
            color: '#71717a',
            callback: v => '$' + v.toLocaleString()
          },
          grid: { color: '#f4f4f5' }
        }
      }
    }
  });
}

async function loadPortfolioStats() {
  try {
    const data = await graphqlQuery(GET_INVESTMENT_HISTORY_QUERY);
    const history = data.investmentHistory || [];

    const empty = document.getElementById('portfolioStatsEmpty');
    const charts = document.getElementById('portfolioStatsCharts');

    if (history.length === 0) {
      empty.style.display = 'block';
      charts.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    charts.style.display = 'flex';

    const labels = history.map(h => h.date);

    const destroyAndCreate = (key, canvasId, label, vals, color) => {
      if (portfolioCharts[key]) portfolioCharts[key].destroy();
      portfolioCharts[key] = makeLineChart(
        document.getElementById(canvasId),
        label, vals, labels, color
      );
    };

    destroyAndCreate('netWorth', 'netWorthChart', 'Net Worth', history.map(h => h.netWorth), '#18181b');
    destroyAndCreate('bank', 'bankHistoryChart', 'Bank Balance', history.map(h => h.bankBalance), '#16a34a');
    destroyAndCreate('hysa', 'hysaHistoryChart', 'HYSA', history.map(h => h.hysaBalance), '#2563eb');
    destroyAndCreate('stock', 'stockHistoryChart', 'Stock Portfolio', history.map(h => h.stockValue), '#9333ea');
  } catch (error) {
    console.error('Error loading portfolio stats:', error);
  }
}

// Fetch summary using GraphQL
async function fetchSummary() {
  try {
    const data = await graphqlQuery(GET_SUMMARY_QUERY);
    const summary = data.summary;
    
    document.getElementById('totalIncome').textContent = formatCurrency(summary.totalIncome);
    document.getElementById('totalExpenses').textContent = formatCurrency(summary.totalExpenses);
    
    const balanceEl = document.getElementById('balance');
    balanceEl.textContent = formatCurrency(summary.balance);
    balanceEl.className = `stat-value ${summary.balance >= 0 ? 'income' : 'expense'}`;
  } catch (error) {
    console.error('Error fetching summary:', error);
  }
}

// Get icon for transaction
function getTransactionIcon(transaction) {
  if (transaction.type === 'income') {
    return '💰';
  }
  return categoryIcons[transaction.category] || '💸';
}

// Render transactions
function renderTransactions(transactions) {
  const listEl = document.getElementById('transactionsList');
  listEl.innerHTML = transactions.map(transaction => `
    <div class="transaction-item">
      <div class="transaction-icon ${transaction.type}">
        ${getTransactionIcon(transaction)}
      </div>
      <div class="transaction-info">
        <div class="transaction-description">${transaction.category || (transaction.type === 'income' ? 'Income' : 'Expense')}</div>
        <div class="transaction-meta">
          <span>${formatDate(transaction.date)}</span>
        </div>
      </div>
      <span class="transaction-amount ${transaction.type === 'income' ? 'amount-income' : 'amount-expense'}">
        ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
      </span>
      <div class="transaction-actions">
        <button class="icon-btn" onclick="editTransaction(${transaction.id})" title="Edit">✏️</button>
        <button class="icon-btn danger" onclick="deleteTransaction(${transaction.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Open add modal
function openAddModal() {
  editingTransactionId = null;
  document.getElementById('modalTitle').textContent = 'Add an expense';
  document.getElementById('submitBtn').textContent = 'Save';
  document.getElementById('transactionForm').reset();
  document.getElementById('type').value = 'expense';
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  setType('expense');
  document.getElementById('modal').style.display = 'flex';
}

// Close modal
function closeModal(event) {
  if (!event || event.target.id === 'modal') {
    document.getElementById('modal').style.display = 'none';
    editingTransactionId = null;
  }
}

// Edit transaction using GraphQL
async function editTransaction(id) {
  try {
    const data = await graphqlQuery(GET_TRANSACTIONS_QUERY);
    const transactions = data.transactions || [];
    const transaction = transactions.find(t => t.id === id);
    
    if (!transaction) {
      alert('Transaction not found');
      return;
    }
    
    editingTransactionId = id;
    document.getElementById('modalTitle').textContent = 'Edit transaction';
    document.getElementById('submitBtn').textContent = 'Save changes';
    document.getElementById('type').value = transaction.type;
    setType(transaction.type);
    document.getElementById('amount').value = transaction.amount;
    document.getElementById('category').value = transaction.category || 'Misc';
    document.getElementById('date').value = transaction.date;
    document.getElementById('modal').style.display = 'flex';
  } catch (error) {
    console.error('Error loading transaction:', error);
    alert('Failed to load transaction: ' + error.message);
  }
}

// Delete transaction using GraphQL
async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) {
    return;
  }
  
  try {
    const data = await graphqlQuery(DELETE_TRANSACTION_MUTATION, { id });
    
    if (data.deleteTransaction.success) {
      await fetchTransactions();
      await fetchSummary();
      // Refresh stats if stats tab is active
      if (document.getElementById('statsTab').classList.contains('active')) {
        await loadStats();
      }
    } else {
      alert(data.deleteTransaction.error || 'Failed to delete transaction');
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    alert('Failed to delete transaction: ' + error.message);
  }
}

// Handle form submit using GraphQL
async function handleSubmit(event) {
  event.preventDefault();
  
  const input = {
    type: document.getElementById('type').value,
    amount: parseFloat(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    date: document.getElementById('date').value,
  };
  
  try {
    let data;
    
    if (editingTransactionId) {
      // Update transaction
      data = await graphqlQuery(UPDATE_TRANSACTION_MUTATION, {
        id: editingTransactionId,
        input: input
      });
      
      if (!data.updateTransaction.success) {
        alert(data.updateTransaction.error || 'Failed to update transaction');
        return;
      }
    } else {
      // Create transaction
      data = await graphqlQuery(CREATE_TRANSACTION_MUTATION, {
        input: input
      });
      
      if (!data.createTransaction.success) {
        alert(data.createTransaction.error || 'Failed to create transaction');
        return;
      }
    }
    
      await fetchTransactions();
      await fetchSummary();
    // Refresh stats if stats tab is active
    if (document.getElementById('statsTab').classList.contains('active')) {
      await loadStats();
    }
    closeModal();
  } catch (error) {
    console.error('Error saving transaction:', error);
    alert('Failed to save transaction: ' + error.message);
  }
}

// Tab switching
function switchTab(tabName) {
  // Update sidebar nav active state
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${tabName}`);
  if (activeNav) activeNav.classList.add('active');

  // Update topbar breadcrumb
  const labels = { transactions: 'Transactions', stats: 'Stats', investments: 'Investments', 'portfolio-stats': 'Portfolio Stats' };
  const pageLabel = labels[tabName] || tabName;
  document.getElementById('topbarPage').textContent = pageLabel;

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  const showSummary = tabName === 'transactions';
  document.getElementById('transactionSummary').style.display = showSummary ? '' : 'none';
  document.getElementById('addTransactionBtn').style.display = showSummary ? '' : 'none';

  if (tabName === 'transactions') {
    document.getElementById('transactionsTab').classList.add('active');
    fetchTransactions();
    fetchSummary();
  } else if (tabName === 'stats') {
    document.getElementById('statsTab').classList.add('active');
    loadStats();
  } else if (tabName === 'investments') {
    document.getElementById('investmentsTab').classList.add('active');
    loadInvestments();
  } else if (tabName === 'portfolio-stats') {
    document.getElementById('portfolioStatsTab').classList.add('active');
    loadPortfolioStats();
  }
}

// Load and render all stats charts using GraphQL
async function loadStats() {
  try {
    const data = await graphqlQuery(GET_TRANSACTIONS_QUERY);
    const transactions = data.transactions || [];
    
    if (transactions.length === 0) {
      // Show empty state for charts
      return;
    }
    
    renderIncomeExpensesChart(transactions);
    renderCategoryChart(transactions);
    renderBalanceChart(transactions);
    renderCategoryTrendChart(transactions);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Chart 1: Income vs Expenses Over Time (Line Chart)
function renderIncomeExpensesChart(transactions) {
  const ctx = document.getElementById('incomeExpensesChart');
  if (!ctx) return;
  
  // Group by month
  const monthlyData = {};
  transactions.forEach(t => {
    const date = new Date(t.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }
    if (t.type === 'income') {
      monthlyData[monthKey].income += t.amount;
    } else {
      monthlyData[monthKey].expenses += t.amount;
    }
  });
  
  const sortedMonths = Object.keys(monthlyData).sort();
  const monthLabels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });
  
  if (charts.incomeExpenses) {
    charts.incomeExpenses.destroy();
  }
  
  charts.incomeExpenses = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'Income',
        data: sortedMonths.map(m => monthlyData[m].income),
        borderColor: '#FCB116',
        backgroundColor: 'rgba(252, 177, 22, 0.2)',
        tension: 0.4,
        fill: true
      }, {
        label: 'Expenses',
        data: sortedMonths.map(m => monthlyData[m].expenses),
        borderColor: '#FF7623',
        backgroundColor: 'rgba(255, 118, 35, 0.2)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: '#FCB116',
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#FCB116'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#121826',
          titleColor: '#FCB116',
          bodyColor: '#e0e0e0',
          borderColor: '#FCB116',
          borderWidth: 2,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#FCB116'
          },
          grid: {
            color: 'rgba(252, 177, 22, 0.1)'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#FCB116',
            callback: function(value) {
              return '$' + value.toFixed(0);
            }
          },
          grid: {
            color: 'rgba(252, 177, 22, 0.1)'
          }
        }
      }
    }
  });
}

// Chart 2: Expenses by Category (Pie Chart)
function renderCategoryChart(transactions) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  
  const expenses = transactions.filter(t => t.type === 'expense');
  const categoryTotals = {};
  
  expenses.forEach(t => {
    const category = t.category || 'Other';
    categoryTotals[category] = (categoryTotals[category] || 0) + t.amount;
  });
  
  const categories = Object.keys(categoryTotals);
  const amounts = categories.map(c => categoryTotals[c]);
  
  if (charts.category) {
    charts.category.destroy();
  }
  
  const colors = {
    'Food': '#FF7623',
    'Rent': '#FCB116',
    'Travel': '#02458D',
    'Misc': '#FF7623'
  };
  
  charts.category = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [{
        data: amounts,
        backgroundColor: categories.map(c => colors[c] || '#95a5a6'),
        borderWidth: 2,
        borderColor: '#02458D'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: '#FCB116',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#FCB116'
          }
        },
        tooltip: {
          backgroundColor: '#121826',
          titleColor: '#FCB116',
          bodyColor: '#e0e0e0',
          borderColor: '#FCB116',
          borderWidth: 2,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return label + ': $' + value.toFixed(2) + ' (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

// Chart 3: Monthly Balance Trend (Line Chart)
function renderBalanceChart(transactions) {
  const ctx = document.getElementById('balanceChart');
  if (!ctx) return;
  
  // Group by month and calculate running balance
  const monthlyData = {};
  transactions.forEach(t => {
    const date = new Date(t.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }
    if (t.type === 'income') {
      monthlyData[monthKey].income += t.amount;
    } else {
      monthlyData[monthKey].expenses += t.amount;
    }
  });
  
  const sortedMonths = Object.keys(monthlyData).sort();
  let runningBalance = 0;
  const balances = sortedMonths.map(m => {
    runningBalance += monthlyData[m].income - monthlyData[m].expenses;
    return runningBalance;
  });
  
  const monthLabels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });
  
  if (charts.balance) {
    charts.balance.destroy();
  }
  
  charts.balance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'Balance',
        data: balances,
        borderColor: '#02458D',
        backgroundColor: function(context) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) {
            return null;
          }
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(2, 69, 141, 0.3)');
          gradient.addColorStop(1, 'rgba(252, 177, 22, 0.05)');
          return gradient;
        },
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: '#b0b0b0',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#2a2a2a',
          titleColor: '#e0e0e0',
          bodyColor: '#b0b0b0',
          borderColor: '#3a3a3a',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const value = context.parsed.y;
              const sign = value >= 0 ? '+' : '';
              return 'Balance: ' + sign + '$' + value.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#888'
          },
          grid: {
            color: '#2a2a2a'
          }
        },
        y: {
          ticks: {
            color: '#888',
            callback: function(value) {
              return '$' + value.toFixed(0);
            }
          },
          grid: {
            color: function(context) {
              if (context.tick.value === 0) {
                return '#FCB116';
              }
              return 'rgba(252, 177, 22, 0.2)';
            }
          }
        }
      }
    }
  });
}

// Chart 4: Category Spending Over Time (Stacked Area Chart)
function renderCategoryTrendChart(transactions) {
  const ctx = document.getElementById('categoryTrendChart');
  if (!ctx) return;
  
  const expenses = transactions.filter(t => t.type === 'expense');
  const monthlyData = {};
  
  expenses.forEach(t => {
    const date = new Date(t.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {};
    }
    const category = t.category || 'Other';
    monthlyData[monthKey][category] = (monthlyData[monthKey][category] || 0) + t.amount;
  });
  
  const sortedMonths = Object.keys(monthlyData).sort();
  const allCategories = ['Food', 'Rent', 'Travel', 'Misc'];
  const monthLabels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });
  
  const categoryColors = {
    'Food': 'rgba(255, 118, 35, 0.8)',
    'Rent': 'rgba(252, 177, 22, 0.8)',
    'Travel': 'rgba(2, 69, 141, 0.8)',
    'Misc': 'rgba(255, 118, 35, 0.8)'
  };
  
  const borderColors = {
    'Food': 'rgba(255, 118, 35, 1)',
    'Rent': 'rgba(252, 177, 22, 1)',
    'Travel': 'rgba(2, 69, 141, 1)',
    'Misc': 'rgba(255, 118, 35, 1)'
  };
  
  const datasets = allCategories.map(category => ({
    label: category,
    data: sortedMonths.map(m => monthlyData[m][category] || 0),
    backgroundColor: categoryColors[category] || 'rgba(149, 165, 166, 0.8)',
    borderColor: borderColors[category] || 'rgba(149, 165, 166, 1)',
    borderWidth: 1
  }));
  
  if (charts.categoryTrend) {
    charts.categoryTrend.destroy();
  }
  
  charts.categoryTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: '#FCB116',
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#FCB116'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#121826',
          titleColor: '#FCB116',
          bodyColor: '#e0e0e0',
          borderColor: '#FCB116',
          borderWidth: 2,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: '#888'
          },
          grid: {
            color: '#2a2a2a'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: '#888',
            callback: function(value) {
              return '$' + value.toFixed(0);
            }
          },
          grid: {
            color: '#2a2a2a'
          }
        }
      }
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  switchTab('investments');
});
