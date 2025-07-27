import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/dashboard/Card';
import { logger } from '@/lib/logger';

interface Transaction {
  id: string;
  description: string;
  merchant?: string;
  amount: number;
  date: string;
  category?: string;
  taxCategory?: string;
  isBusinessExpense: boolean;
}

interface TransactionCategorizerProps {
  transaction: Transaction | Transaction[];
  onCategorize: (updates: CategoryUpdate[]) => Promise<void>;
  onClose?: () => void;
  categories?: Category[];
  taxCategories?: TaxCategory[];
  className?: string;
}

interface CategoryUpdate {
  transactionId: string;
  category: string;
  taxCategory?: string;
  isBusinessExpense: boolean;
  notes?: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  keywords?: string[];
  isBusinessDefault?: boolean;
}

interface TaxCategory {
  code: string;
  name: string;
  description?: string;
}

interface CategoryRule {
  id: string;
  pattern: string;
  category: string;
  taxCategory?: string;
  isBusinessExpense: boolean;
  priority: number;
}

interface AISuggestion {
  category: string;
  taxCategory?: string;
  confidence: number;
  reason?: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'groceries',
    name: 'Groceries',
    icon: '🛒',
    keywords: ['woolworths', 'coles', 'aldi', 'iga'],
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: '🚗',
    keywords: ['uber', 'fuel', 'petrol', 'parking'],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: '💡',
    keywords: ['electricity', 'gas', 'water', 'internet'],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    keywords: ['cinema', 'netflix', 'spotify'],
  },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', keywords: ['amazon', 'ebay', 'store'] },
  { id: 'dining', name: 'Dining', icon: '🍴', keywords: ['restaurant', 'cafe', 'takeaway'] },
  { id: 'health', name: 'Health', icon: '🏥', keywords: ['pharmacy', 'doctor', 'medical'] },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    keywords: ['course', 'training', 'university'],
  },
  {
    id: 'business',
    name: 'Business',
    icon: '💼',
    keywords: ['office', 'supplies', 'software'],
    isBusinessDefault: true,
  },
  { id: 'other', name: 'Other', icon: '📦', keywords: [] },
];

const DEFAULT_TAX_CATEGORIES: TaxCategory[] = [
  { code: 'D1', name: 'Car expenses', description: 'Work-related car expenses' },
  { code: 'D2', name: 'Travel expenses', description: 'Work-related travel' },
  { code: 'D3', name: 'Clothing expenses', description: 'Work-related clothing' },
  { code: 'D4', name: 'Self-education expenses', description: 'Work-related education' },
  { code: 'D5', name: 'Other work-related expenses', description: 'Other expenses for work' },
  { code: 'D10', name: 'Cost of managing tax affairs', description: 'Tax agent fees' },
  { code: 'P8', name: 'Personal expenses', description: 'Non-deductible personal expenses' },
];

export const TransactionCategorizer: React.FC<TransactionCategorizerProps> = ({
  transaction,
  onCategorize,
  onClose,
  categories = DEFAULT_CATEGORIES,
  taxCategories = DEFAULT_TAX_CATEGORIES,
  className = '',
}) => {
  const transactions = Array.isArray(transaction) ? transaction : [transaction];
  const isBulk = transactions.length > 1;

  const [updates, setUpdates] = useState<Record<string, CategoryUpdate>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTaxCategory, setSelectedTaxCategory] = useState<string>('');
  const [isBusinessExpense, setIsBusinessExpense] = useState(false);
  const [notes, setNotes] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestion>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [newRule, setNewRule] = useState<Partial<CategoryRule>>({});

  // Initialize updates for each transaction
  useEffect(() => {
    const initialUpdates: Record<string, CategoryUpdate> = {};
    transactions.forEach((tx) => {
      initialUpdates[tx.id] = {
        transactionId: tx.id,
        category: tx.category || '',
        taxCategory: tx.taxCategory || '',
        isBusinessExpense: tx.isBusinessExpense || false,
        notes: '',
      };
    });
    setUpdates(initialUpdates);

    // Set initial values from first transaction
    if (transactions.length > 0) {
      const first = transactions[0];
      setSelectedCategory(first.category || '');
      setSelectedTaxCategory(first.taxCategory || '');
      setIsBusinessExpense(first.isBusinessExpense || false);
    }
  }, [transactions]);

  // Load saved rules
  useEffect(() => {
    const savedRules = localStorage.getItem('categoryRules');
    if (savedRules) {
      setRules(JSON.parse(savedRules));
    }
  }, []);

  // Get AI suggestions
  const getAISuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const suggestions: Record<string, AISuggestion> = {};

      for (const tx of transactions) {
        const response = await fetch('/api/ai/categorize-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: tx.description,
            merchant: tx.merchant,
            amount: tx.amount,
          }),
        });

        if (response.ok) {
          const suggestion = await response.json();
          suggestions[tx.id] = suggestion;
        }
      }

      setAiSuggestions(suggestions);
    } catch (error) {
      logger.error('Failed to get AI suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [transactions]);

  // Apply rule-based categorization
  const applyRules = useCallback(() => {
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    transactions.forEach((tx) => {
      const description = `${tx.description} ${tx.merchant || ''}`.toLowerCase();

      for (const rule of sortedRules) {
        const pattern = new RegExp(rule.pattern, 'i');
        if (pattern.test(description)) {
          setUpdates((prev) => ({
            ...prev,
            [tx.id]: {
              ...prev[tx.id],
              category: rule.category,
              taxCategory: rule.taxCategory || '',
              isBusinessExpense: rule.isBusinessExpense,
            },
          }));
          break;
        }
      }
    });
  }, [rules, transactions]);

  // Quick categorize based on keywords
  const quickCategorize = useCallback(() => {
    transactions.forEach((tx) => {
      const description = `${tx.description} ${tx.merchant || ''}`.toLowerCase();

      for (const category of categories) {
        if (category.keywords?.some((keyword) => description.includes(keyword.toLowerCase()))) {
          setUpdates((prev) => ({
            ...prev,
            [tx.id]: {
              ...prev[tx.id],
              category: category.id,
              isBusinessExpense: category.isBusinessDefault || false,
            },
          }));
          break;
        }
      }
    });
  }, [categories, transactions]);

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);

    if (applyToAll) {
      const newUpdates = { ...updates };
      Object.keys(newUpdates).forEach((txId) => {
        newUpdates[txId].category = categoryId;
      });
      setUpdates(newUpdates);
    } else if (transactions.length === 1) {
      setUpdates((prev) => ({
        ...prev,
        [transactions[0].id]: {
          ...prev[transactions[0].id],
          category: categoryId,
        },
      }));
    }
  };

  // Handle tax category selection
  const handleTaxCategorySelect = (taxCategoryCode: string) => {
    setSelectedTaxCategory(taxCategoryCode);

    if (applyToAll) {
      const newUpdates = { ...updates };
      Object.keys(newUpdates).forEach((txId) => {
        newUpdates[txId].taxCategory = taxCategoryCode;
      });
      setUpdates(newUpdates);
    } else if (transactions.length === 1) {
      setUpdates((prev) => ({
        ...prev,
        [transactions[0].id]: {
          ...prev[transactions[0].id],
          taxCategory: taxCategoryCode,
        },
      }));
    }
  };

  // Handle business expense toggle
  const handleBusinessExpenseToggle = (value: boolean) => {
    setIsBusinessExpense(value);

    if (applyToAll) {
      const newUpdates = { ...updates };
      Object.keys(newUpdates).forEach((txId) => {
        newUpdates[txId].isBusinessExpense = value;
      });
      setUpdates(newUpdates);
    } else if (transactions.length === 1) {
      setUpdates((prev) => ({
        ...prev,
        [transactions[0].id]: {
          ...prev[transactions[0].id],
          isBusinessExpense: value,
        },
      }));
    }
  };

  // Apply AI suggestion
  const applySuggestion = (transactionId: string) => {
    const suggestion = aiSuggestions[transactionId];
    if (!suggestion) return;

    setUpdates((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        category: suggestion.category,
        taxCategory: suggestion.taxCategory || '',
        isBusinessExpense: suggestion.taxCategory !== 'P8',
      },
    }));
  };

  // Save categorization
  const handleSave = async () => {
    setSaving(true);
    try {
      const updatesToSave = Object.values(updates).filter(
        (update) => update.category || update.taxCategory,
      );

      if (notes && applyToAll) {
        updatesToSave.forEach((update) => {
          update.notes = notes;
        });
      } else if (notes && transactions.length === 1) {
        updatesToSave[0].notes = notes;
      }

      await onCategorize(updatesToSave);

      // Save as rule if requested
      if (newRule.pattern) {
        const rule: CategoryRule = {
          id: Date.now().toString(),
          pattern: newRule.pattern,
          category: selectedCategory,
          taxCategory: selectedTaxCategory,
          isBusinessExpense,
          priority: rules.length + 1,
        };
        const updatedRules = [...rules, rule];
        setRules(updatedRules);
        localStorage.setItem('categoryRules', JSON.stringify(updatedRules));
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      logger.error('Failed to save categorization:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete rule
  const deleteRule = (ruleId: string) => {
    const updatedRules = rules.filter((r) => r.id !== ruleId);
    setRules(updatedRules);
    localStorage.setItem('categoryRules', JSON.stringify(updatedRules));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">
            {isBulk ? `Categorize ${transactions.length} Transactions` : 'Categorize Transaction'}
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={getAISuggestions}
            className="btn btn-sm btn-secondary"
            disabled={loadingSuggestions}
          >
            {loadingSuggestions ? (
              <>
                <span className="spinner mr-2" />
                Getting Suggestions...
              </>
            ) : (
              '🤖 AI Suggestions'
            )}
          </button>
          <button
            onClick={quickCategorize}
            className="btn btn-sm btn-secondary"
          >
            ⚡ Quick Categorize
          </button>
          <button
            onClick={applyRules}
            className="btn btn-sm btn-secondary"
            disabled={rules.length === 0}
          >
            📋 Apply Rules ({rules.length})
          </button>
          <button
            onClick={() => setShowRules(!showRules)}
            className="btn btn-sm btn-secondary"
          >
            ⚙️ Manage Rules
          </button>
        </div>

        {/* Apply to All Toggle (for bulk) */}
        {isBulk && (
          <label className="flex items-center p-3 bg-blue-50 rounded-lg">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="rounded text-blue-600 mr-2"
            />
            <span className="text-sm">Apply selections to all transactions</span>
          </label>
        )}
      </Card>

      {/* Transaction List */}
      <Card>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {transactions.map((tx) => {
            const update = updates[tx.id];
            const suggestion = aiSuggestions[tx.id];

            return (
              <div
                key={tx.id}
                className="p-3 border rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{tx.merchant || tx.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(tx.date).toLocaleDateString('en-AU')} • $
                      {Math.abs(tx.amount).toFixed(2)}
                    </p>
                  </div>
                  {suggestion && (
                    <button
                      onClick={() => applySuggestion(tx.id)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Apply AI ({Math.round(suggestion.confidence * 100)}%)
                    </button>
                  )}
                </div>

                {/* Category Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={update.category}
                      onChange={(e) =>
                        setUpdates((prev) => ({
                          ...prev,
                          [tx.id]: { ...prev[tx.id], category: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      disabled={applyToAll}
                    >
                      <option value="">Select category...</option>
                      {categories.map((cat) => (
                        <option
                          key={cat.id}
                          value={cat.id}
                        >
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Category
                    </label>
                    <select
                      value={update.taxCategory}
                      onChange={(e) =>
                        setUpdates((prev) => ({
                          ...prev,
                          [tx.id]: { ...prev[tx.id], taxCategory: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      disabled={applyToAll}
                    >
                      <option value="">Select tax category...</option>
                      {taxCategories.map((cat) => (
                        <option
                          key={cat.code}
                          value={cat.code}
                        >
                          {cat.code} - {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    checked={update.isBusinessExpense}
                    onChange={(e) =>
                      setUpdates((prev) => ({
                        ...prev,
                        [tx.id]: { ...prev[tx.id], isBusinessExpense: e.target.checked },
                      }))
                    }
                    className="rounded text-blue-600 mr-2"
                    disabled={applyToAll}
                  />
                  <span className="text-sm">Business expense</span>
                </label>

                {/* AI Suggestion Display */}
                {suggestion && suggestion.reason && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                    <strong>AI:</strong> {suggestion.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Common Fields (for single or apply to all) */}
      {(transactions.length === 1 || applyToAll) && (
        <Card>
          <h4 className="font-medium mb-3">Category Details</h4>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`p-3 text-center border rounded-lg transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-xs">{cat.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Category</label>
              <select
                value={selectedTaxCategory}
                onChange={(e) => handleTaxCategorySelect(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select tax category...</option>
                {taxCategories.map((cat) => (
                  <option
                    key={cat.code}
                    value={cat.code}
                  >
                    {cat.code} - {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isBusinessExpense}
                onChange={(e) => handleBusinessExpenseToggle(e.target.checked)}
                className="rounded text-blue-600 mr-2"
              />
              <span className="text-sm">Mark as business expense</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Add any notes about this categorization..."
              />
            </div>

            {/* Save as Rule */}
            {transactions.length === 1 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={!!newRule.pattern}
                    onChange={(e) =>
                      setNewRule(
                        e.target.checked
                          ? { pattern: transactions[0].merchant || transactions[0].description }
                          : {},
                      )
                    }
                    className="rounded text-blue-600 mr-2"
                  />
                  <span className="text-sm">Save as rule for similar transactions</span>
                </label>
                {newRule.pattern && (
                  <input
                    type="text"
                    value={newRule.pattern}
                    onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                    className="mt-2 w-full px-3 py-1 border rounded text-sm"
                    placeholder="Pattern to match..."
                  />
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Rules Management */}
      {showRules && (
        <Card>
          <h4 className="font-medium mb-3">Categorization Rules</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rules.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No rules created yet</p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="text-sm">
                    <span className="font-medium">{rule.pattern}</span>
                    <span className="text-gray-500 ml-2">
                      → {categories.find((c) => c.id === rule.category)?.name}
                      {rule.taxCategory && ` (${rule.taxCategory})`}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          className="btn btn-primary ml-auto"
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="spinner mr-2" />
              Saving...
            </>
          ) : (
            `Save Categorization${isBulk ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
};

export default TransactionCategorizer;
