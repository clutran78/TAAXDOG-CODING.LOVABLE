/**
 * Security utility functions for preventing XSS attacks
 */

// HTML escaping function to prevent XSS
export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return unsafe;
  }
  
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Safely create DOM element with escaped text content
export function createSafeElement(tag, content, attributes = {}) {
  const element = document.createElement(tag);
  
  if (content !== undefined && content !== null) {
    element.textContent = content;
  }
  
  // Set attributes safely
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  return element;
}

// Example of fixed income sources display function
export function displayIncomeSourcesSafely(incomeBySource, totalIncome, sourcesContainer) {
  // Clear container
  sourcesContainer.innerHTML = '';
  
  Object.entries(incomeBySource).forEach(([source, amount]) => {
    const percentage = ((amount / totalIncome) * 100).toFixed(1);
    
    // Create card structure using DOM methods
    const card = createSafeElement('div', null, { class: 'card mb-3' });
    const cardBody = createSafeElement('div', null, { class: 'card-body' });
    
    // Header section
    const headerDiv = createSafeElement('div', null, { 
      class: 'd-flex justify-content-between align-items-center' 
    });
    const sourceTitle = createSafeElement('h5', source, { class: 'mb-0' });
    const percentageBadge = createSafeElement('span', `${percentage}%`, { 
      class: 'badge bg-success' 
    });
    headerDiv.appendChild(sourceTitle);
    headerDiv.appendChild(percentageBadge);
    
    // Amount section
    const amountDiv = createSafeElement('div', null, { 
      class: 'd-flex justify-content-between align-items-center mt-2' 
    });
    const monthlyLabel = createSafeElement('div', 'Monthly income', { 
      class: 'text-secondary' 
    });
    const amountValue = createSafeElement('h4', formatCurrency(amount), { 
      class: 'text-success mb-0' 
    });
    amountDiv.appendChild(monthlyLabel);
    amountDiv.appendChild(amountValue);
    
    // Progress bar
    const progressDiv = createSafeElement('div', null, { 
      class: 'progress mt-3',
      style: { height: '5px' }
    });
    const progressBar = createSafeElement('div', null, {
      class: 'progress-bar bg-success',
      role: 'progressbar',
      style: { width: `${percentage}%` },
      'aria-valuenow': percentage,
      'aria-valuemin': '0',
      'aria-valuemax': '100'
    });
    progressDiv.appendChild(progressBar);
    
    // Assemble card
    cardBody.appendChild(headerDiv);
    cardBody.appendChild(amountDiv);
    cardBody.appendChild(progressDiv);
    card.appendChild(cardBody);
    sourcesContainer.appendChild(card);
  });
}

// Example of fixed transaction display
export function displayTransactionSafely(transaction, container) {
  const row = createSafeElement('tr');
  
  // Description cell
  const descCell = createSafeElement('td', transaction.description);
  
  // Amount cell
  const amountCell = createSafeElement('td', formatCurrency(transaction.amount), {
    class: transaction.type === 'income' ? 'text-success' : 'text-danger'
  });
  
  // Date cell
  const dateCell = createSafeElement('td', formatDate(transaction.date));
  
  // Type cell
  const typeCell = createSafeElement('td');
  const typeBadge = createSafeElement('span', transaction.type, {
    class: `badge bg-${transaction.type === 'income' ? 'success' : 'danger'}`
  });
  typeCell.appendChild(typeBadge);
  
  row.appendChild(descCell);
  row.appendChild(amountCell);
  row.appendChild(dateCell);
  row.appendChild(typeCell);
  
  container.appendChild(row);
}

// Safe template literal replacement
export function safeTemplate(template, data) {
  return template.replace(/\${([^}]+)}/g, (match, key) => {
    const value = data[key.trim()];
    return escapeHtml(value);
  });
}

// Example usage for fixing existing innerHTML usage:
// Instead of: element.innerHTML = `<div>${userContent}</div>`;
// Use: 
// const div = createSafeElement('div', userContent);
// element.appendChild(div);

// Or for complex HTML:
// const template = '<div class="user-info">Name: ${name}, Email: ${email}</div>';
// element.innerHTML = safeTemplate(template, { name: userName, email: userEmail });