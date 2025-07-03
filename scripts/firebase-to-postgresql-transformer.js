const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Australian data validators
const AustralianValidators = {
  // Validate Australian BSB (Bank State Branch) number
  validateBSB: (bsb) => {
    if (!bsb) return { valid: false, formatted: null, error: 'BSB is required' };
    
    const cleaned = bsb.toString().replace(/[\s-]/g, '');
    
    if (!/^\d{6}$/.test(cleaned)) {
      return { valid: false, formatted: null, error: 'BSB must be exactly 6 digits' };
    }
    
    // Format as XXX-XXX
    const formatted = `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`;
    
    // Validate against known Australian BSB ranges
    const firstTwo = parseInt(cleaned.substring(0, 2));
    const validRanges = [
      [1, 3],   // NSW
      [6, 9],   // VIC
      [11, 19], // VIC
      [30, 39], // WA
      [40, 49], // QLD
      [50, 59], // SA
      [60, 69], // TAS
      [70, 79], // ACT/NSW
      [80, 89], // NT
      [90, 99]  // Other
    ];
    
    const isValidRange = validRanges.some(([min, max]) => firstTwo >= min && firstTwo <= max);
    
    if (!isValidRange) {
      return { valid: false, formatted: formatted, error: 'Invalid BSB range for Australian banks' };
    }
    
    return { valid: true, formatted: formatted, error: null };
  },

  // Validate Australian phone numbers
  validatePhone: (phone) => {
    if (!phone) return { valid: true, formatted: null, error: null }; // Phone is optional
    
    const cleaned = phone.toString().replace(/[\s\-\(\)]/g, '');
    
    // Australian mobile numbers (04XX XXX XXX)
    if (/^04\d{8}$/.test(cleaned)) {
      return {
        valid: true,
        formatted: `+61${cleaned.substring(1)}`,
        error: null
      };
    }
    
    // Australian landline numbers (0X XXXX XXXX)
    if (/^0[2-9]\d{8}$/.test(cleaned)) {
      return {
        valid: true,
        formatted: `+61${cleaned.substring(1)}`,
        error: null
      };
    }
    
    // Already in international format
    if (/^(\+)?614\d{8}$/.test(cleaned)) {
      return {
        valid: true,
        formatted: cleaned.startsWith('+') ? cleaned : `+${cleaned}`,
        error: null
      };
    }
    
    // Already in international landline format
    if (/^(\+)?61[2-9]\d{8}$/.test(cleaned)) {
      return {
        valid: true,
        formatted: cleaned.startsWith('+') ? cleaned : `+${cleaned}`,
        error: null
      };
    }
    
    return {
      valid: false,
      formatted: null,
      error: 'Invalid Australian phone number format'
    };
  },

  // Validate Australian Business Number (ABN)
  validateABN: (abn) => {
    if (!abn) return { valid: true, formatted: null, error: null }; // ABN is optional
    
    const cleaned = abn.toString().replace(/\s/g, '');
    
    if (!/^\d{11}$/.test(cleaned)) {
      return { valid: false, formatted: null, error: 'ABN must be exactly 11 digits' };
    }
    
    // ABN checksum validation
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = cleaned.split('').map(Number);
    
    // Subtract 1 from first digit
    digits[0] -= 1;
    
    // Calculate weighted sum
    const sum = digits.reduce((acc, digit, index) => acc + (digit * weights[index]), 0);
    
    if (sum % 89 !== 0) {
      return { valid: false, formatted: cleaned, error: 'Invalid ABN checksum' };
    }
    
    return { valid: true, formatted: cleaned, error: null };
  },

  // Validate Tax File Number (TFN)
  validateTFN: (tfn) => {
    if (!tfn) return { valid: true, formatted: null, error: null }; // TFN is optional
    
    const cleaned = tfn.toString().replace(/\s/g, '');
    
    if (!/^\d{8,9}$/.test(cleaned)) {
      return { valid: false, formatted: null, error: 'TFN must be 8 or 9 digits' };
    }
    
    // TFN checksum validation
    const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    const digits = cleaned.padStart(9, '0').split('').map(Number);
    
    const sum = digits.reduce((acc, digit, index) => acc + (digit * weights[index]), 0);
    
    if (sum % 11 !== 0) {
      return { valid: false, formatted: cleaned, error: 'Invalid TFN checksum' };
    }
    
    return { valid: true, formatted: cleaned, error: null };
  },

  // Validate Australian currency amounts
  validateCurrency: (amount) => {
    if (amount === null || amount === undefined) {
      return { valid: false, formatted: null, error: 'Amount is required' };
    }
    
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
      return { valid: false, formatted: null, error: 'Invalid amount format' };
    }
    
    // Round to 2 decimal places for AUD
    const formatted = Math.round(numAmount * 100) / 100;
    
    return { valid: true, formatted: formatted, error: null };
  },

  // Calculate GST (10% Australian GST rate)
  calculateGST: (amount, isGSTInclusive = true) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return { gstAmount: 0, netAmount: 0, totalAmount: 0 };
    
    if (isGSTInclusive) {
      const gstAmount = Math.round(numAmount / 11 * 100) / 100;
      const netAmount = Math.round((numAmount - gstAmount) * 100) / 100;
      return { gstAmount, netAmount, totalAmount: numAmount };
    } else {
      const gstAmount = Math.round(numAmount * 0.1 * 100) / 100;
      const totalAmount = Math.round((numAmount + gstAmount) * 100) / 100;
      return { gstAmount, netAmount: numAmount, totalAmount };
    }
  },

  // Validate email format
  validateEmail: (email) => {
    if (!email) return { valid: false, formatted: null, error: 'Email is required' };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = email.trim().toLowerCase();
    
    if (!emailRegex.test(trimmed)) {
      return { valid: false, formatted: null, error: 'Invalid email format' };
    }
    
    return { valid: true, formatted: trimmed, error: null };
  },

  // Validate Australian bank account number
  validateAccountNumber: (accountNumber) => {
    if (!accountNumber) return { valid: false, formatted: null, error: 'Account number is required' };
    
    const cleaned = accountNumber.toString().replace(/[\s-]/g, '');
    
    if (!/^\d{6,10}$/.test(cleaned)) {
      return { valid: false, formatted: null, error: 'Account number must be 6-10 digits' };
    }
    
    return { valid: true, formatted: cleaned, error: null };
  },

  // Validate Australian institution names
  validateInstitution: (name) => {
    const knownInstitutions = [
      'Commonwealth Bank', 'CBA',
      'Westpac', 'WBC',
      'ANZ', 'Australia and New Zealand Banking Group',
      'National Australia Bank', 'NAB',
      'Macquarie Bank',
      'ING', 'ING Direct',
      'Bank of Queensland', 'BOQ',
      'Bendigo Bank',
      'Suncorp',
      'St.George Bank',
      'BankWest',
      'ME Bank',
      'HSBC Australia',
      'Citibank',
      'Rabobank',
      'AMP Bank',
      'Bank Australia',
      'Beyond Bank',
      'Heritage Bank'
    ];
    
    if (!name) return { valid: false, formatted: null, error: 'Institution name is required' };
    
    const normalized = name.trim();
    const isKnown = knownInstitutions.some(inst => 
      normalized.toLowerCase().includes(inst.toLowerCase())
    );
    
    return {
      valid: true,
      formatted: normalized,
      isKnownInstitution: isKnown,
      error: null
    };
  }
};

// ATO-compliant tax categories
const ATOTaxCategories = {
  mapCategory: (firebaseCategory) => {
    const mapping = {
      'income': 'INCOME',
      'business_expense': 'BUSINESS_EXPENSE',
      'personal': 'PERSONAL',
      'investment': 'INVESTMENT',
      'gst_payable': 'GST_PAYABLE',
      'gst_receivable': 'GST_RECEIVABLE',
      'capital': 'CAPITAL',
      'depreciation': 'DEPRECIATION',
      'deductible': 'DEDUCTIBLE',
      'non_deductible': 'NON_DEDUCTIBLE'
    };
    
    const normalized = (firebaseCategory || '').toLowerCase().replace(/\s+/g, '_');
    return mapping[normalized] || 'UNCATEGORIZED';
  },

  validateCategory: (category) => {
    const validCategories = [
      'INCOME',
      'BUSINESS_EXPENSE',
      'PERSONAL',
      'INVESTMENT',
      'GST_PAYABLE',
      'GST_RECEIVABLE',
      'CAPITAL',
      'DEPRECIATION',
      'DEDUCTIBLE',
      'NON_DEDUCTIBLE',
      'UNCATEGORIZED'
    ];
    
    return validCategories.includes(category);
  }
};

// ID mapping and relationship management
class IDMapper {
  constructor() {
    this.mappings = {
      users: new Map(),
      bankAccounts: new Map(),
      transactions: new Map(),
      receipts: new Map(),
      budgets: new Map(),
      budgetTracking: new Map(),
      financialInsights: new Map()
    };
  }

  generateUUID(firebaseId, collection) {
    const namespace = `taaxdog-${collection}`;
    const hash = crypto.createHash('sha256')
      .update(namespace + firebaseId)
      .digest('hex');
    
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '4' + hash.substring(13, 16),
      ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  mapID(firebaseId, collection) {
    if (!firebaseId) return null;
    
    if (!this.mappings[collection].has(firebaseId)) {
      const uuid = this.generateUUID(firebaseId, collection);
      this.mappings[collection].set(firebaseId, uuid);
    }
    
    return this.mappings[collection].get(firebaseId);
  }

  getMapping(firebaseId, collection) {
    return this.mappings[collection].get(firebaseId);
  }

  exportMappings() {
    const result = {};
    for (const [collection, map] of Object.entries(this.mappings)) {
      result[collection] = Object.fromEntries(map);
    }
    return result;
  }
}

// Main transformation class
class FirebaseToPostgreSQLTransformer {
  constructor() {
    this.idMapper = new IDMapper();
    this.validationErrors = [];
    this.transformationStats = {
      collections: {},
      totalRecords: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      validationErrors: 0
    };
  }

  // Transform Firebase timestamp to PostgreSQL timestamp
  transformTimestamp(timestamp) {
    if (!timestamp) return null;
    
    // Handle Firestore timestamp format
    if (timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000).toISOString();
    }
    
    // Handle Firebase timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    
    // Handle string timestamps
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    
    // Handle milliseconds timestamp
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toISOString();
    }
    
    return null;
  }

  // Transform user document
  transformUser(firebaseDoc) {
    const errors = [];
    const pgRecord = {
      id: this.idMapper.mapID(firebaseDoc._firebaseId || firebaseDoc.id, 'users')
    };

    // Validate and transform email
    const emailValidation = AustralianValidators.validateEmail(firebaseDoc.email);
    if (emailValidation.valid) {
      pgRecord.email = emailValidation.formatted;
    } else {
      errors.push({ field: 'email', error: emailValidation.error });
      pgRecord.email = firebaseDoc.email || '';
    }

    // Basic fields
    pgRecord.name = firebaseDoc.name || '';
    pgRecord.emailVerified = this.transformTimestamp(firebaseDoc.emailVerified);
    
    // Validate and transform phone
    if (firebaseDoc.phone) {
      const phoneValidation = AustralianValidators.validatePhone(firebaseDoc.phone);
      if (phoneValidation.valid) {
        pgRecord.phone = phoneValidation.formatted;
      } else {
        errors.push({ field: 'phone', error: phoneValidation.error });
        pgRecord.phone = firebaseDoc.phone;
      }
    }

    // Password (already hashed)
    pgRecord.password = firebaseDoc.password || null;
    pgRecord.image = firebaseDoc.image || null;
    
    // Role and residency
    pgRecord.role = firebaseDoc.role || 'USER';
    pgRecord.taxResidency = firebaseDoc.taxResidency || 'RESIDENT';
    
    // Validate ABN
    if (firebaseDoc.abn) {
      const abnValidation = AustralianValidators.validateABN(firebaseDoc.abn);
      if (abnValidation.valid) {
        pgRecord.abn = abnValidation.formatted;
      } else {
        errors.push({ field: 'abn', error: abnValidation.error });
        pgRecord.abn = firebaseDoc.abn;
      }
    }

    // Validate TFN
    if (firebaseDoc.tfn) {
      const tfnValidation = AustralianValidators.validateTFN(firebaseDoc.tfn);
      if (tfnValidation.valid) {
        pgRecord.tfn = tfnValidation.formatted;
      } else {
        errors.push({ field: 'tfn', error: tfnValidation.error });
        pgRecord.tfn = firebaseDoc.tfn;
      }
    }

    // Security fields
    pgRecord.failedLoginAttempts = firebaseDoc.failedLoginAttempts || 0;
    pgRecord.lockedUntil = this.transformTimestamp(firebaseDoc.lockedUntil);
    pgRecord.lastLoginAt = this.transformTimestamp(firebaseDoc.lastLoginAt);
    pgRecord.lastLoginIp = firebaseDoc.lastLoginIp || null;
    pgRecord.twoFactorEnabled = firebaseDoc.twoFactorEnabled || false;
    pgRecord.twoFactorSecret = firebaseDoc.twoFactorSecret || null;
    
    // Timestamps
    pgRecord.createdAt = this.transformTimestamp(firebaseDoc.createdAt) || new Date().toISOString();
    pgRecord.updatedAt = this.transformTimestamp(firebaseDoc.updatedAt) || pgRecord.createdAt;

    return { record: pgRecord, errors };
  }

  // Transform bank account document
  transformBankAccount(firebaseDoc) {
    const errors = [];
    const pgRecord = {
      id: this.idMapper.mapID(firebaseDoc._firebaseId || firebaseDoc.id, 'bankAccounts')
    };

    // Link to user
    if (firebaseDoc.userId) {
      pgRecord.userId = this.idMapper.getMapping(firebaseDoc.userId, 'users');
      if (!pgRecord.userId) {
        errors.push({ field: 'userId', error: 'User reference not found' });
      }
    } else {
      errors.push({ field: 'userId', error: 'User ID is required' });
    }

    // Account details
    pgRecord.accountName = firebaseDoc.accountName || 'Unknown Account';
    
    // Validate BSB
    if (firebaseDoc.bsb) {
      const bsbValidation = AustralianValidators.validateBSB(firebaseDoc.bsb);
      if (bsbValidation.valid) {
        pgRecord.bsb = bsbValidation.formatted;
      } else {
        errors.push({ field: 'bsb', error: bsbValidation.error });
        pgRecord.bsb = firebaseDoc.bsb;
      }
    } else {
      errors.push({ field: 'bsb', error: 'BSB is required' });
    }

    // Validate account number
    if (firebaseDoc.accountNumber) {
      const accountValidation = AustralianValidators.validateAccountNumber(firebaseDoc.accountNumber);
      if (accountValidation.valid) {
        pgRecord.accountNumber = accountValidation.formatted;
      } else {
        errors.push({ field: 'accountNumber', error: accountValidation.error });
        pgRecord.accountNumber = firebaseDoc.accountNumber;
      }
    } else {
      errors.push({ field: 'accountNumber', error: 'Account number is required' });
    }

    // Validate institution
    if (firebaseDoc.institutionName) {
      const institutionValidation = AustralianValidators.validateInstitution(firebaseDoc.institutionName);
      pgRecord.institutionName = institutionValidation.formatted;
      if (!institutionValidation.isKnownInstitution) {
        errors.push({ 
          field: 'institutionName', 
          error: 'Warning: Unknown Australian financial institution',
          severity: 'warning'
        });
      }
    }

    // Balance
    if (firebaseDoc.balance !== undefined) {
      const balanceValidation = AustralianValidators.validateCurrency(firebaseDoc.balance);
      if (balanceValidation.valid) {
        pgRecord.balance = balanceValidation.formatted;
      } else {
        errors.push({ field: 'balance', error: balanceValidation.error });
        pgRecord.balance = 0;
      }
    } else {
      pgRecord.balance = 0;
    }

    // BASIQ integration
    pgRecord.basiqConnectionId = firebaseDoc.basiqConnectionId || null;
    pgRecord.basiqInstitutionId = firebaseDoc.basiqInstitutionId || null;
    pgRecord.lastSyncedAt = this.transformTimestamp(firebaseDoc.lastSyncedAt);
    
    // Status
    pgRecord.isActive = firebaseDoc.isActive !== false;
    
    // Timestamps
    pgRecord.createdAt = this.transformTimestamp(firebaseDoc.createdAt) || new Date().toISOString();
    pgRecord.updatedAt = this.transformTimestamp(firebaseDoc.updatedAt) || pgRecord.createdAt;

    return { record: pgRecord, errors };
  }

  // Transform transaction document
  transformTransaction(firebaseDoc) {
    const errors = [];
    const pgRecord = {
      id: this.idMapper.mapID(firebaseDoc._firebaseId || firebaseDoc.id, 'transactions')
    };

    // Link to user
    if (firebaseDoc.userId) {
      pgRecord.userId = this.idMapper.getMapping(firebaseDoc.userId, 'users');
      if (!pgRecord.userId) {
        errors.push({ field: 'userId', error: 'User reference not found' });
      }
    } else {
      errors.push({ field: 'userId', error: 'User ID is required' });
    }

    // Link to bank account
    if (firebaseDoc.bankAccountId) {
      pgRecord.bankAccountId = this.idMapper.getMapping(firebaseDoc.bankAccountId, 'bankAccounts');
      if (!pgRecord.bankAccountId) {
        errors.push({ field: 'bankAccountId', error: 'Bank account reference not found' });
      }
    } else {
      errors.push({ field: 'bankAccountId', error: 'Bank account ID is required' });
    }

    // Amount validation
    const amountValidation = AustralianValidators.validateCurrency(firebaseDoc.amount);
    if (amountValidation.valid) {
      pgRecord.amount = amountValidation.formatted;
    } else {
      errors.push({ field: 'amount', error: amountValidation.error });
      pgRecord.amount = 0;
    }

    // Transaction details
    pgRecord.description = firebaseDoc.description || '';
    pgRecord.date = this.transformTimestamp(firebaseDoc.date) || new Date().toISOString();
    
    // Tax category
    pgRecord.taxCategory = ATOTaxCategories.mapCategory(firebaseDoc.taxCategory);
    if (!ATOTaxCategories.validateCategory(pgRecord.taxCategory)) {
      errors.push({ field: 'taxCategory', error: 'Invalid tax category' });
    }

    // GST calculation
    if (firebaseDoc.gstAmount !== undefined) {
      const gstValidation = AustralianValidators.validateCurrency(firebaseDoc.gstAmount);
      if (gstValidation.valid) {
        pgRecord.gstAmount = gstValidation.formatted;
      } else {
        pgRecord.gstAmount = 0;
      }
    } else if (pgRecord.taxCategory === 'BUSINESS_EXPENSE') {
      // Auto-calculate GST for business expenses
      const gstCalc = AustralianValidators.calculateGST(pgRecord.amount, true);
      pgRecord.gstAmount = gstCalc.gstAmount;
    } else {
      pgRecord.gstAmount = 0;
    }

    // Additional fields
    pgRecord.basiqTransactionId = firebaseDoc.basiqTransactionId || null;
    pgRecord.merchantName = firebaseDoc.merchantName || null;
    pgRecord.isReconciled = firebaseDoc.isReconciled || false;
    
    // Metadata as JSONB
    if (firebaseDoc.metadata) {
      pgRecord.metadata = JSON.stringify(firebaseDoc.metadata);
    }

    // Timestamps
    pgRecord.createdAt = this.transformTimestamp(firebaseDoc.createdAt) || new Date().toISOString();
    pgRecord.updatedAt = this.transformTimestamp(firebaseDoc.updatedAt) || pgRecord.createdAt;

    return { record: pgRecord, errors };
  }

  // Transform receipt document
  transformReceipt(firebaseDoc) {
    const errors = [];
    const pgRecord = {
      id: this.idMapper.mapID(firebaseDoc._firebaseId || firebaseDoc.id, 'receipts')
    };

    // Link to user
    if (firebaseDoc.userId || firebaseDoc.user_id) {
      const userId = firebaseDoc.userId || firebaseDoc.user_id;
      pgRecord.user_id = this.idMapper.getMapping(userId, 'users');
      if (!pgRecord.user_id) {
        errors.push({ field: 'user_id', error: 'User reference not found' });
      }
    } else {
      errors.push({ field: 'user_id', error: 'User ID is required' });
    }

    // Link to transaction (optional)
    if (firebaseDoc.transactionId || firebaseDoc.transaction_id) {
      const transactionId = firebaseDoc.transactionId || firebaseDoc.transaction_id;
      pgRecord.transaction_id = this.idMapper.getMapping(transactionId, 'transactions');
      if (!pgRecord.transaction_id) {
        errors.push({ field: 'transaction_id', error: 'Transaction reference not found', severity: 'warning' });
      }
    }

    // Receipt details
    pgRecord.merchant = firebaseDoc.merchant || firebaseDoc.merchantName || null;
    
    // Total amount
    const totalAmount = firebaseDoc.totalAmount || firebaseDoc.total_amount;
    if (totalAmount !== undefined) {
      const amountValidation = AustralianValidators.validateCurrency(totalAmount);
      if (amountValidation.valid) {
        pgRecord.total_amount = amountValidation.formatted;
      } else {
        errors.push({ field: 'total_amount', error: amountValidation.error });
        pgRecord.total_amount = 0;
      }
    } else {
      pgRecord.total_amount = 0;
    }

    // GST amount
    const gstAmount = firebaseDoc.gstAmount || firebaseDoc.gst_amount;
    if (gstAmount !== undefined) {
      const gstValidation = AustralianValidators.validateCurrency(gstAmount);
      if (gstValidation.valid) {
        pgRecord.gst_amount = gstValidation.formatted;
        
        // Validate GST is approximately 10% of total
        if (pgRecord.total_amount > 0) {
          const expectedGst = pgRecord.total_amount / 11;
          const gstDifference = Math.abs(pgRecord.gst_amount - expectedGst);
          if (gstDifference > 0.1) {
            errors.push({ 
              field: 'gst_amount', 
              error: `GST amount differs from expected 10% by $${gstDifference.toFixed(2)}`,
              severity: 'warning'
            });
          }
        }
      } else {
        pgRecord.gst_amount = 0;
      }
    } else {
      // Auto-calculate GST
      const gstCalc = AustralianValidators.calculateGST(pgRecord.total_amount, true);
      pgRecord.gst_amount = gstCalc.gstAmount;
    }

    // Date
    pgRecord.date = this.transformTimestamp(firebaseDoc.date) || null;
    
    // Items as JSONB
    if (firebaseDoc.items) {
      pgRecord.items = JSON.stringify(firebaseDoc.items);
    }

    // Image URL
    pgRecord.image_url = firebaseDoc.imageUrl || firebaseDoc.image_url || null;
    
    // AI processing fields
    pgRecord.ai_processed = firebaseDoc.aiProcessed || firebaseDoc.ai_processed || false;
    
    const aiConfidence = firebaseDoc.aiConfidence || firebaseDoc.ai_confidence;
    if (aiConfidence !== undefined) {
      if (aiConfidence >= 0 && aiConfidence <= 1) {
        pgRecord.ai_confidence = aiConfidence;
      } else {
        errors.push({ field: 'ai_confidence', error: 'Confidence score must be between 0 and 1' });
        pgRecord.ai_confidence = null;
      }
    }

    pgRecord.ai_provider = firebaseDoc.aiProvider || firebaseDoc.ai_provider || null;
    pgRecord.ai_model = firebaseDoc.aiModel || firebaseDoc.ai_model || null;
    pgRecord.processing_status = firebaseDoc.processingStatus || firebaseDoc.processing_status || 'pending';

    // Timestamps
    pgRecord.created_at = this.transformTimestamp(firebaseDoc.createdAt || firebaseDoc.created_at) || new Date().toISOString();
    pgRecord.updated_at = this.transformTimestamp(firebaseDoc.updatedAt || firebaseDoc.updated_at) || pgRecord.created_at;

    return { record: pgRecord, errors };
  }

  // Transform budget document
  transformBudget(firebaseDoc) {
    const errors = [];
    const pgRecord = {
      id: this.idMapper.mapID(firebaseDoc._firebaseId || firebaseDoc.id, 'budgets')
    };

    // Link to user
    if (firebaseDoc.userId || firebaseDoc.user_id) {
      const userId = firebaseDoc.userId || firebaseDoc.user_id;
      pgRecord.user_id = this.idMapper.getMapping(userId, 'users');
      if (!pgRecord.user_id) {
        errors.push({ field: 'user_id', error: 'User reference not found' });
      }
    } else {
      errors.push({ field: 'user_id', error: 'User ID is required' });
    }

    // Budget details
    pgRecord.name = firebaseDoc.name || 'Unnamed Budget';
    
    // Monthly budget
    const monthlyBudget = firebaseDoc.monthlyBudget || firebaseDoc.monthly_budget;
    const budgetValidation = AustralianValidators.validateCurrency(monthlyBudget);
    if (budgetValidation.valid) {
      pgRecord.monthly_budget = budgetValidation.formatted;
    } else {
      errors.push({ field: 'monthly_budget', error: budgetValidation.error });
      pgRecord.monthly_budget = 0;
    }

    // Target savings
    const targetSavings = firebaseDoc.targetSavings || firebaseDoc.target_savings;
    if (targetSavings !== undefined) {
      const savingsValidation = AustralianValidators.validateCurrency(targetSavings);
      if (savingsValidation.valid) {
        pgRecord.target_savings = savingsValidation.formatted;
      } else {
        pgRecord.target_savings = 0;
      }
    }

    // Monthly income
    const monthlyIncome = firebaseDoc.monthlyIncome || firebaseDoc.monthly_income;
    if (monthlyIncome !== undefined) {
      const incomeValidation = AustralianValidators.validateCurrency(monthlyIncome);
      if (incomeValidation.valid) {
        pgRecord.monthly_income = incomeValidation.formatted;
      } else {
        pgRecord.monthly_income = 0;
      }
    }

    // JSONB fields
    if (firebaseDoc.predictions) {
      pgRecord.predictions = JSON.stringify(firebaseDoc.predictions);
    }
    
    const categoryLimits = firebaseDoc.categoryLimits || firebaseDoc.category_limits;
    if (categoryLimits) {
      pgRecord.category_limits = JSON.stringify(categoryLimits);
    }

    // AI fields
    const confidenceScore = firebaseDoc.confidenceScore || firebaseDoc.confidence_score;
    if (confidenceScore !== undefined) {
      if (confidenceScore >= 0 && confidenceScore <= 1) {
        pgRecord.confidence_score = confidenceScore;
      } else {
        errors.push({ field: 'confidence_score', error: 'Confidence score must be between 0 and 1' });
      }
    }

    pgRecord.ai_provider = firebaseDoc.aiProvider || firebaseDoc.ai_provider || null;
    pgRecord.ai_model = firebaseDoc.aiModel || firebaseDoc.ai_model || null;
    pgRecord.analysis_period = firebaseDoc.analysisPeriod || firebaseDoc.analysis_period || null;
    pgRecord.prediction_period = firebaseDoc.predictionPeriod || firebaseDoc.prediction_period || null;
    pgRecord.status = firebaseDoc.status || 'active';

    // Timestamps
    pgRecord.created_at = this.transformTimestamp(firebaseDoc.createdAt || firebaseDoc.created_at) || new Date().toISOString();
    pgRecord.updated_at = this.transformTimestamp(firebaseDoc.updatedAt || firebaseDoc.updated_at) || pgRecord.created_at;

    return { record: pgRecord, errors };
  }

  // Transform budget tracking document
  transformBudgetTracking(firebaseDoc) {
    const errors = [];
    const pgRecord = {
      id: this.idMapper.mapID(firebaseDoc._firebaseId || firebaseDoc.id, 'budgetTracking')
    };

    // Link to budget
    if (firebaseDoc.budgetId || firebaseDoc.budget_id) {
      const budgetId = firebaseDoc.budgetId || firebaseDoc.budget_id;
      pgRecord.budget_id = this.idMapper.getMapping(budgetId, 'budgets');
      if (!pgRecord.budget_id) {
        errors.push({ field: 'budget_id', error: 'Budget reference not found' });
      }
    } else {
      errors.push({ field: 'budget_id', error: 'Budget ID is required' });
    }

    // Link to user
    if (firebaseDoc.userId || firebaseDoc.user_id) {
      const userId = firebaseDoc.userId || firebaseDoc.user_id;
      pgRecord.user_id = this.idMapper.getMapping(userId, 'users');
      if (!pgRecord.user_id) {
        errors.push({ field: 'user_id', error: 'User reference not found' });
      }
    } else {
      errors.push({ field: 'user_id', error: 'User ID is required' });
    }

    // Time period
    pgRecord.month = firebaseDoc.month;
    pgRecord.year = firebaseDoc.year;
    
    if (!pgRecord.month || pgRecord.month < 1 || pgRecord.month > 12) {
      errors.push({ field: 'month', error: 'Month must be between 1 and 12' });
    }
    
    if (!pgRecord.year || pgRecord.year < 2020 || pgRecord.year > 2030) {
      errors.push({ field: 'year', error: 'Year must be between 2020 and 2030' });
    }

    // Amounts
    const predictedAmount = firebaseDoc.predictedAmount || firebaseDoc.predicted_amount;
    if (predictedAmount !== undefined) {
      const predictedValidation = AustralianValidators.validateCurrency(predictedAmount);
      if (predictedValidation.valid) {
        pgRecord.predicted_amount = predictedValidation.formatted;
      } else {
        pgRecord.predicted_amount = 0;
      }
    } else {
      pgRecord.predicted_amount = 0;
    }

    const actualAmount = firebaseDoc.actualAmount || firebaseDoc.actual_amount;
    if (actualAmount !== undefined) {
      const actualValidation = AustralianValidators.validateCurrency(actualAmount);
      if (actualValidation.valid) {
        pgRecord.actual_amount = actualValidation.formatted;
      } else {
        pgRecord.actual_amount = 0;
      }
    } else {
      pgRecord.actual_amount = 0;
    }

    // Calculate variance
    pgRecord.variance = Math.round((pgRecord.predicted_amount - pgRecord.actual_amount) * 100) / 100;
    
    // Category
    pgRecord.category = firebaseDoc.category || null;

    // Timestamp
    pgRecord.created_at = this.transformTimestamp(firebaseDoc.createdAt || firebaseDoc.created_at) || new Date().toISOString();

    return { record: pgRecord, errors };
  }

  // Transform financial insight document
  transformFinancialInsight(firebaseDoc) {
    const errors = [];
    const pgRecord = {
      id: this.idMapper.mapID(firebaseDoc._firebaseId || firebaseDoc.id, 'financialInsights')
    };

    // Link to user
    if (firebaseDoc.userId || firebaseDoc.user_id) {
      const userId = firebaseDoc.userId || firebaseDoc.user_id;
      pgRecord.user_id = this.idMapper.getMapping(userId, 'users');
      if (!pgRecord.user_id) {
        errors.push({ field: 'user_id', error: 'User reference not found' });
      }
    } else {
      errors.push({ field: 'user_id', error: 'User ID is required' });
    }

    // Insight details
    pgRecord.insight_type = firebaseDoc.insightType || firebaseDoc.insight_type || 'GENERAL';
    pgRecord.category = firebaseDoc.category || null;
    
    // JSONB fields
    if (firebaseDoc.content) {
      pgRecord.content = JSON.stringify(firebaseDoc.content);
    }
    
    if (firebaseDoc.recommendations) {
      pgRecord.recommendations = JSON.stringify(firebaseDoc.recommendations);
    }

    // Confidence score
    const confidenceScore = firebaseDoc.confidenceScore || firebaseDoc.confidence_score;
    if (confidenceScore !== undefined) {
      if (confidenceScore >= 0 && confidenceScore <= 1) {
        pgRecord.confidence_score = confidenceScore;
      } else {
        errors.push({ field: 'confidence_score', error: 'Confidence score must be between 0 and 1' });
      }
    }

    // Source data IDs
    const sourceDataIds = firebaseDoc.sourceDataIds || firebaseDoc.source_data_ids;
    if (sourceDataIds && Array.isArray(sourceDataIds)) {
      pgRecord.source_data_ids = sourceDataIds;
    } else {
      pgRecord.source_data_ids = [];
    }

    // AI provider info
    pgRecord.provider = firebaseDoc.provider || null;
    pgRecord.model = firebaseDoc.model || null;
    
    // Additional fields
    pgRecord.title = firebaseDoc.title || null;
    pgRecord.description = firebaseDoc.description || null;
    pgRecord.priority = firebaseDoc.priority || 'MEDIUM';
    
    // Validate priority
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(pgRecord.priority)) {
      errors.push({ field: 'priority', error: 'Invalid priority level' });
      pgRecord.priority = 'MEDIUM';
    }

    pgRecord.is_active = firebaseDoc.isActive !== false && firebaseDoc.is_active !== false;

    // Timestamps
    pgRecord.created_at = this.transformTimestamp(firebaseDoc.createdAt || firebaseDoc.created_at) || new Date().toISOString();
    pgRecord.expires_at = this.transformTimestamp(firebaseDoc.expiresAt || firebaseDoc.expires_at);

    return { record: pgRecord, errors };
  }

  // Transform collection
  async transformCollection(collectionName, documents) {
    console.log(`\nTransforming ${collectionName}...`);
    
    const transformedRecords = [];
    const collectionErrors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const doc of documents) {
      try {
        let result;
        
        switch (collectionName) {
          case 'users':
            result = this.transformUser(doc);
            break;
          case 'bankAccounts':
            result = this.transformBankAccount(doc);
            break;
          case 'transactions':
            result = this.transformTransaction(doc);
            break;
          case 'receipts':
            result = this.transformReceipt(doc);
            break;
          case 'budgets':
            result = this.transformBudget(doc);
            break;
          case 'budgetTracking':
            result = this.transformBudgetTracking(doc);
            break;
          case 'financialInsights':
            result = this.transformFinancialInsight(doc);
            break;
          default:
            throw new Error(`Unknown collection: ${collectionName}`);
        }

        transformedRecords.push(result.record);
        
        if (result.errors.length > 0) {
          collectionErrors.push({
            documentId: doc._firebaseId || doc.id,
            errors: result.errors
          });
          this.validationErrors.push({
            collection: collectionName,
            documentId: doc._firebaseId || doc.id,
            errors: result.errors
          });
        }
        
        successCount++;
      } catch (error) {
        errorCount++;
        collectionErrors.push({
          documentId: doc._firebaseId || doc.id,
          errors: [{ field: 'document', error: error.message }]
        });
      }
    }

    // Update stats
    this.transformationStats.collections[collectionName] = {
      total: documents.length,
      successful: successCount,
      failed: errorCount,
      validationErrors: collectionErrors.length
    };
    
    this.transformationStats.totalRecords += documents.length;
    this.transformationStats.successfulTransformations += successCount;
    this.transformationStats.failedTransformations += errorCount;
    this.transformationStats.validationErrors += collectionErrors.length;

    console.log(`  ✓ Transformed ${successCount}/${documents.length} documents`);
    if (collectionErrors.length > 0) {
      console.log(`  ⚠ ${collectionErrors.length} documents have validation issues`);
    }

    return {
      records: transformedRecords,
      errors: collectionErrors
    };
  }

  // Verify data integrity
  verifyDataIntegrity(transformedData) {
    console.log('\nVerifying data integrity...');
    
    const integrityReport = {
      missingReferences: [],
      duplicateEmails: [],
      invalidAmounts: [],
      dateIssues: []
    };

    // Check user email uniqueness
    const emailMap = new Map();
    transformedData.users?.forEach(user => {
      if (emailMap.has(user.email)) {
        integrityReport.duplicateEmails.push({
          email: user.email,
          userIds: [emailMap.get(user.email), user.id]
        });
      } else {
        emailMap.set(user.email, user.id);
      }
    });

    // Check foreign key references
    const userIds = new Set(transformedData.users?.map(u => u.id) || []);
    const bankAccountIds = new Set(transformedData.bankAccounts?.map(b => b.id) || []);
    const budgetIds = new Set(transformedData.budgets?.map(b => b.id) || []);
    const transactionIds = new Set(transformedData.transactions?.map(t => t.id) || []);

    // Verify bank account references
    transformedData.bankAccounts?.forEach(account => {
      if (account.userId && !userIds.has(account.userId)) {
        integrityReport.missingReferences.push({
          collection: 'bankAccounts',
          documentId: account.id,
          field: 'userId',
          missingId: account.userId
        });
      }
    });

    // Verify transaction references
    transformedData.transactions?.forEach(transaction => {
      if (transaction.userId && !userIds.has(transaction.userId)) {
        integrityReport.missingReferences.push({
          collection: 'transactions',
          documentId: transaction.id,
          field: 'userId',
          missingId: transaction.userId
        });
      }
      if (transaction.bankAccountId && !bankAccountIds.has(transaction.bankAccountId)) {
        integrityReport.missingReferences.push({
          collection: 'transactions',
          documentId: transaction.id,
          field: 'bankAccountId',
          missingId: transaction.bankAccountId
        });
      }
    });

    // Check amount validations
    const checkAmounts = (records, collection) => {
      records?.forEach(record => {
        const amountFields = ['amount', 'total_amount', 'gst_amount', 'balance', 'monthly_budget'];
        amountFields.forEach(field => {
          if (record[field] !== undefined && record[field] !== null) {
            if (typeof record[field] !== 'number' || record[field] < 0) {
              integrityReport.invalidAmounts.push({
                collection,
                documentId: record.id,
                field,
                value: record[field]
              });
            }
          }
        });
      });
    };

    Object.entries(transformedData).forEach(([collection, records]) => {
      checkAmounts(records, collection);
    });

    console.log('  ✓ Data integrity check complete');
    if (integrityReport.missingReferences.length > 0) {
      console.log(`  ⚠ ${integrityReport.missingReferences.length} missing references found`);
    }
    if (integrityReport.duplicateEmails.length > 0) {
      console.log(`  ⚠ ${integrityReport.duplicateEmails.length} duplicate emails found`);
    }

    return integrityReport;
  }

  // Export transformation report
  async exportReport(outputDir) {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.transformationStats,
      idMappings: this.idMapper.exportMappings(),
      validationErrors: this.validationErrors,
      summary: {
        successRate: (this.transformationStats.successfulTransformations / this.transformationStats.totalRecords * 100).toFixed(2) + '%',
        totalValidationErrors: this.validationErrors.length
      }
    };

    const reportPath = path.join(outputDir, 'transformation_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`\nTransformation report saved to: ${reportPath}`);
    
    return report;
  }
}

// Export main transformation function
async function transformFirebaseToPostgreSQL(inputDir, outputDir) {
  console.log('Firebase to PostgreSQL Data Transformation');
  console.log('=========================================\n');

  const transformer = new FirebaseToPostgreSQLTransformer();
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
    
    const collections = [
      'users',
      'bankAccounts',
      'budgets',
      'transactions',
      'receipts',
      'budgetTracking',
      'financialInsights'
    ];
    
    const transformedData = {};
    
    // Transform each collection
    for (const collection of collections) {
      try {
        const inputPath = path.join(inputDir, `${collection}.json`);
        const documents = JSON.parse(await fs.readFile(inputPath, 'utf8'));
        
        const result = await transformer.transformCollection(collection, documents);
        transformedData[collection] = result.records;
        
        // Save transformed data
        const outputPath = path.join(outputDir, `${collection}_transformed.json`);
        await fs.writeFile(outputPath, JSON.stringify(result.records, null, 2), 'utf8');
        
        // Save errors if any
        if (result.errors.length > 0) {
          const errorsPath = path.join(outputDir, `${collection}_errors.json`);
          await fs.writeFile(errorsPath, JSON.stringify(result.errors, null, 2), 'utf8');
        }
      } catch (error) {
        console.error(`Error transforming ${collection}:`, error.message);
      }
    }
    
    // Verify data integrity
    const integrityReport = transformer.verifyDataIntegrity(transformedData);
    await fs.writeFile(
      path.join(outputDir, 'integrity_report.json'),
      JSON.stringify(integrityReport, null, 2),
      'utf8'
    );
    
    // Export final report
    await transformer.exportReport(outputDir);
    
    console.log('\nTransformation complete!');
    console.log(`Output directory: ${outputDir}`);
    
  } catch (error) {
    console.error('\nTransformation failed:', error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const inputDir = process.argv[2] || path.join(__dirname, '../firebase-exports');
  const outputDir = process.argv[3] || path.join(__dirname, '../firebase-transformed');
  
  transformFirebaseToPostgreSQL(inputDir, outputDir)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  FirebaseToPostgreSQLTransformer,
  AustralianValidators,
  ATOTaxCategories,
  IDMapper,
  transformFirebaseToPostgreSQL
};