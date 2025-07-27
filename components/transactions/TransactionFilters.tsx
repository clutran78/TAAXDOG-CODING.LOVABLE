import React, { useState, useEffect } from 'react';
import { Card } from '@/components/dashboard/Card';

interface TransactionFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  category?: string;
  taxCategory?: string;
  type?: 'debit' | 'credit' | 'all';
  businessOnly?: boolean;
  uncategorizedOnly?: boolean;
  hasReceipt?: boolean;
  accountId?: string;
  tags?: string[];
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  accounts?: Account[];
  categories?: Category[];
  taxCategories?: TaxCategory[];
  className?: string;
  showAdvanced?: boolean;
}

interface Account {
  id: string;
  name: string;
  institution?: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface TaxCategory {
  code: string;
  name: string;
  description?: string;
}

const DEFAULT_TAX_CATEGORIES: TaxCategory[] = [
  { code: 'D1', name: 'Car expenses' },
  { code: 'D2', name: 'Travel expenses' },
  { code: 'D3', name: 'Clothing expenses' },
  { code: 'D4', name: 'Self-education expenses' },
  { code: 'D5', name: 'Other work-related expenses' },
  { code: 'D10', name: 'Cost of managing tax affairs' },
  { code: 'P8', name: 'Personal expenses (non-deductible)' },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: '🛒' },
  { id: 'transport', name: 'Transport', icon: '🚗' },
  { id: 'utilities', name: 'Utilities', icon: '💡' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'dining', name: 'Dining', icon: '🍴' },
  { id: 'health', name: 'Health', icon: '🏥' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'other', name: 'Other', icon: '📦' },
];

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  onFiltersChange,
  accounts = [],
  categories = DEFAULT_CATEGORIES,
  taxCategories = DEFAULT_TAX_CATEGORIES,
  className = '',
  showAdvanced = false,
}) => {
  const [localFilters, setLocalFilters] = useState<TransactionFilters>(filters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(showAdvanced);
  const [datePreset, setDatePreset] = useState<string>('custom');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  interface SavedFilter {
    id: string;
    name: string;
    filters: TransactionFilters;
  }

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Handle filter change
  const handleFilterChange = (
    key: keyof TransactionFilters,
    value: TransactionFilters[keyof TransactionFilters],
  ) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Handle date preset
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    let dateFrom = new Date();
    let dateTo = new Date();

    switch (preset) {
      case 'today':
        dateFrom = new Date(today);
        dateTo = new Date(today);
        break;
      case 'yesterday':
        dateFrom = new Date(today);
        dateFrom.setDate(dateFrom.getDate() - 1);
        dateTo = new Date(dateFrom);
        break;
      case 'week':
        dateFrom = new Date(today);
        dateFrom.setDate(dateFrom.getDate() - 7);
        dateTo = new Date(today);
        break;
      case 'month':
        dateFrom = new Date(today);
        dateFrom.setMonth(dateFrom.getMonth() - 1);
        dateTo = new Date(today);
        break;
      case 'quarter':
        dateFrom = new Date(today);
        dateFrom.setMonth(dateFrom.getMonth() - 3);
        dateTo = new Date(today);
        break;
      case 'year':
        dateFrom = new Date(today);
        dateFrom.setFullYear(dateFrom.getFullYear() - 1);
        dateTo = new Date(today);
        break;
      case 'tax-year':
        // Australian tax year (July 1 - June 30)
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        if (currentMonth >= 6) {
          // July or later
          dateFrom = new Date(currentYear, 6, 1); // July 1 of current year
          dateTo = new Date(currentYear + 1, 5, 30); // June 30 of next year
        } else {
          dateFrom = new Date(currentYear - 1, 6, 1); // July 1 of previous year
          dateTo = new Date(currentYear, 5, 30); // June 30 of current year
        }
        break;
      case 'all':
        handleFilterChange('dateFrom', '');
        handleFilterChange('dateTo', '');
        return;
      default:
        return;
    }

    handleFilterChange('dateFrom', dateFrom.toISOString().split('T')[0]);
    handleFilterChange('dateTo', dateTo.toISOString().split('T')[0]);
  };

  // Clear all filters
  const clearAllFilters = () => {
    const clearedFilters: TransactionFilters = {
      search: '',
      type: 'all',
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    setDatePreset('all');
  };

  // Save current filters
  const saveCurrentFilters = () => {
    if (!filterName.trim()) return;

    const newSavedFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName,
      filters: { ...localFilters },
    };

    const updatedSavedFilters = [...savedFilters, newSavedFilter];
    setSavedFilters(updatedSavedFilters);
    localStorage.setItem('savedTransactionFilters', JSON.stringify(updatedSavedFilters));

    setFilterName('');
    setShowSaveDialog(false);
  };

  // Load saved filters
  useEffect(() => {
    const saved = localStorage.getItem('savedTransactionFilters');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  // Apply saved filter
  const applySavedFilter = (savedFilter: SavedFilter) => {
    setLocalFilters(savedFilter.filters);
    onFiltersChange(savedFilter.filters);
  };

  // Delete saved filter
  const deleteSavedFilter = (filterId: string) => {
    const updated = savedFilters.filter((f) => f.id !== filterId);
    setSavedFilters(updated);
    localStorage.setItem('savedTransactionFilters', JSON.stringify(updated));
  };

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(
    ([key, value]) =>
      value && value !== '' && value !== 'all' && (Array.isArray(value) ? value.length > 0 : true),
  ).length;

  return (
    <Card className={className}>
      <div className="space-y-4">
        {/* Quick Filters Row */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search transactions..."
              value={localFilters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date Preset */}
          <select
            value={datePreset}
            onChange={(e) => handleDatePreset(e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="custom">Custom Date</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last month</option>
            <option value="quarter">Last quarter</option>
            <option value="year">Last year</option>
            <option value="tax-year">Tax year</option>
            <option value="all">All time</option>
          </select>

          {/* Transaction Type */}
          <select
            value={localFilters.type || 'all'}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="credit">Credits Only</option>
            <option value="debit">Debits Only</option>
          </select>

          {/* Quick Toggles */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={localFilters.businessOnly || false}
              onChange={(e) => handleFilterChange('businessOnly', e.target.checked)}
              className="rounded text-blue-600 mr-2"
            />
            <span className="text-sm">Business Only</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={localFilters.hasReceipt || false}
              onChange={(e) => handleFilterChange('hasReceipt', e.target.checked)}
              className="rounded text-blue-600 mr-2"
            />
            <span className="text-sm">Has Receipt</span>
          </label>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
          >
            <svg
              className={`w-4 h-4 mr-1 transform transition-transform ${
                showAdvancedFilters ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            Advanced Filters
          </button>

          <div className="flex items-center space-x-2">
            {activeFilterCount > 0 && (
              <>
                <span className="text-sm text-gray-600">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              </>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={localFilters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={localFilters.amountMin || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'amountMin',
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    className="w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={localFilters.amountMax || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'amountMax',
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    className="w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={localFilters.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Category</label>
                <select
                  value={localFilters.taxCategory || ''}
                  onChange={(e) => handleFilterChange('taxCategory', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Tax Categories</option>
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

            {/* Account Filter */}
            {accounts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                <select
                  value={localFilters.accountId || ''}
                  onChange={(e) => handleFilterChange('accountId', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Accounts</option>
                  {accounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name} {account.institution && `(${account.institution})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Additional Options */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={localFilters.uncategorizedOnly || false}
                  onChange={(e) => handleFilterChange('uncategorizedOnly', e.target.checked)}
                  className="rounded text-blue-600 mr-2"
                />
                <span className="text-sm">Uncategorized Only</span>
              </label>
            </div>
          </div>
        )}

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Saved Filters</h4>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                + Save Current
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 hover:bg-gray-200"
                >
                  <button
                    onClick={() => applySavedFilter(filter)}
                    className="mr-2"
                  >
                    {filter.name}
                  </button>
                  <button
                    onClick={() => deleteSavedFilter(filter.id)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Filter Dialog */}
        {showSaveDialog && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Filter name..."
                className="flex-1 px-3 py-1 border rounded"
              />
              <button
                onClick={saveCurrentFilters}
                className="btn btn-sm btn-primary"
                disabled={!filterName.trim()}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setFilterName('');
                }}
                className="btn btn-sm btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TransactionFilters;
