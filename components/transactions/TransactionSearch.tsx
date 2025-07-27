import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';

interface SearchResult {
  id: string;
  date: string;
  description: string;
  merchant?: string;
  amount: number;
  category?: string;
  accountName?: string;
  type: 'debit' | 'credit';
  highlight?: {
    field: string;
    match: string;
  };
}

interface TransactionSearchProps {
  onResultSelect?: (transaction: SearchResult) => void;
  onSearchChange?: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showRecent?: boolean;
  className?: string;
}

export const TransactionSearch: React.FC<TransactionSearchProps> = ({
  onResultSelect,
  onSearchChange,
  placeholder = 'Search transactions...',
  autoFocus = false,
  showRecent = true,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchMode, setSearchMode] = useState<'simple' | 'advanced'>('simple');
  const [advancedQuery, setAdvancedQuery] = useState({
    merchant: '',
    category: '',
    minAmount: '',
    maxAmount: '',
    dateFrom: '',
    dateTo: '',
    accountName: '',
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Load recent searches
  useEffect(() => {
    const saved = localStorage.getItem('recentTransactionSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Handle search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() && searchMode === 'simple') {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        let url = '/api/transactions/search';
        let params = new URLSearchParams();

        if (searchMode === 'simple') {
          params.append('q', searchQuery);
        } else {
          // Advanced search parameters
          Object.entries(advancedQuery).forEach(([key, value]) => {
            if (value) params.append(key, value);
          });
        }

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        setResults(data.results || []);
        setShowDropdown(true);
        setSelectedIndex(-1);
      } catch (error) {
        logger.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [searchMode, advancedQuery],
  );

  // Effect for debounced search
  useEffect(() => {
    if (debouncedQuery || searchMode === 'advanced') {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery, performSearch]);

  // Save to recent searches
  const saveToRecent = (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    const updated = [searchTerm, ...recentSearches.filter((s) => s !== searchTerm)].slice(0, 10);

    setRecentSearches(updated);
    localStorage.setItem('recentTransactionSearches', JSON.stringify(updated));
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    saveToRecent(query);
    setShowDropdown(false);
    setQuery('');

    if (onResultSelect) {
      onResultSelect(result);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultSelect(results[selectedIndex]);
        } else if (query.trim()) {
          performSearch(query);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        searchInputRef.current?.blur();
        break;
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format currency
  const formatAmount = (amount: number, type: 'debit' | 'credit') => {
    const prefix = type === 'credit' ? '+' : '-';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  };

  // Highlight search match
  const highlightMatch = (text: string, match: string) => {
    if (!match) return text;

    const regex = new RegExp(`(${match})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-yellow-200"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentTransactionSearches');
  };

  // Perform advanced search
  const performAdvancedSearch = () => {
    performSearch('');
  };

  return (
    <div
      className={`relative ${className}`}
      ref={dropdownRef}
    >
      {/* Search Mode Toggle */}
      <div className="flex items-center space-x-2 mb-2">
        <button
          onClick={() => setSearchMode('simple')}
          className={`text-sm px-3 py-1 rounded ${
            searchMode === 'simple'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Simple Search
        </button>
        <button
          onClick={() => setSearchMode('advanced')}
          className={`text-sm px-3 py-1 rounded ${
            searchMode === 'advanced'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Advanced Search
        </button>
      </div>

      {searchMode === 'simple' ? (
        // Simple Search
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {loading && (
            <div className="absolute right-3 top-3">
              <div className="spinner-sm" />
            </div>
          )}
        </div>
      ) : (
        // Advanced Search
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Merchant name"
              value={advancedQuery.merchant}
              onChange={(e) => setAdvancedQuery({ ...advancedQuery, merchant: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="text"
              placeholder="Category"
              value={advancedQuery.category}
              onChange={(e) => setAdvancedQuery({ ...advancedQuery, category: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="number"
              placeholder="Min amount"
              value={advancedQuery.minAmount}
              onChange={(e) => setAdvancedQuery({ ...advancedQuery, minAmount: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="number"
              placeholder="Max amount"
              value={advancedQuery.maxAmount}
              onChange={(e) => setAdvancedQuery({ ...advancedQuery, maxAmount: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="date"
              placeholder="From date"
              value={advancedQuery.dateFrom}
              onChange={(e) => setAdvancedQuery({ ...advancedQuery, dateFrom: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="date"
              placeholder="To date"
              value={advancedQuery.dateTo}
              onChange={(e) => setAdvancedQuery({ ...advancedQuery, dateTo: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
          </div>
          <button
            onClick={performAdvancedSearch}
            className="btn btn-primary w-full"
          >
            Search
          </button>
        </div>
      )}

      {/* Dropdown Results */}
      {showDropdown && searchMode === 'simple' && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-96 overflow-y-auto">
          {/* Recent Searches */}
          {!query && showRecent && recentSearches.length > 0 && (
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Recent Searches</h4>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setQuery(search);
                      performSearch(search);
                    }}
                    className="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
                  >
                    <svg
                      className="w-4 h-4 mr-2 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                    selectedIndex === index ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {result.highlight?.field === 'merchant'
                        ? highlightMatch(
                            result.merchant || result.description,
                            result.highlight.match,
                          )
                        : highlightMatch(result.description, query)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(result.date).toLocaleDateString('en-AU')}
                      {result.category && ` • ${result.category}`}
                      {result.accountName && ` • ${result.accountName}`}
                    </div>
                  </div>
                  <div
                    className={`font-medium ml-4 ${
                      result.type === 'credit' ? 'text-green-600' : 'text-gray-900'
                    }`}
                  >
                    {formatAmount(result.amount, result.type)}
                  </div>
                </button>
              ))}
            </div>
          ) : query && !loading ? (
            <div className="p-4 text-center text-gray-500">No transactions found for "{query}"</div>
          ) : null}

          {/* Search Tips */}
          {!query && !showRecent && (
            <div className="p-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Search Tips:</p>
              <ul className="space-y-1 text-xs">
                <li>• Search by merchant name or description</li>
                <li>• Use quotes for exact matches: "coffee shop"</li>
                <li>• Search by amount: $50 or 50.00</li>
                <li>• Search by category: groceries, transport</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Advanced Search Results */}
      {searchMode === 'advanced' && results.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-gray-700">
            Found {results.length} transaction{results.length !== 1 ? 's' : ''}
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultSelect(result)}
                className="w-full p-3 text-left bg-white border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{result.merchant || result.description}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(result.date).toLocaleDateString('en-AU')}
                      {result.category && ` • ${result.category}`}
                    </div>
                  </div>
                  <div
                    className={`font-medium ${
                      result.type === 'credit' ? 'text-green-600' : 'text-gray-900'
                    }`}
                  >
                    {formatAmount(result.amount, result.type)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default TransactionSearch;
