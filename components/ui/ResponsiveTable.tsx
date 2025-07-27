import React from 'react';
import { useResponsive } from '@/lib/utils/responsive';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: T[keyof T] | unknown, item: T) => React.ReactNode;
  className?: string;
  priority?: 'high' | 'medium' | 'low'; // For responsive hiding
  mobileLabel?: boolean; // Show label on mobile
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  stickyHeader?: boolean;
}

export function ResponsiveTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  loading,
  emptyMessage = 'No data available',
  className = '',
  stickyHeader = false,
}: ResponsiveTableProps<T>) {
  const { isMobile } = useResponsive();

  if (loading) {
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex space-x-4 p-4 border-b"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Mobile card layout
  if (isMobile) {
    return (
      <div className={`space-y-4 ${className}`}>
        {data.map((item) => {
          const key = keyExtractor(item);
          return (
            <div
              key={key}
              onClick={() => onRowClick?.(item)}
              className={`
                bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
                ${onRowClick ? 'cursor-pointer hover:shadow-md transition-shadow touch-manipulation' : ''}
              `}
            >
              <div className="p-4 space-y-3">
                {columns
                  .filter((col) => col.priority !== 'low')
                  .map((column) => {
                    const value = column.key.includes('.')
                      ? column.key.split('.').reduce((obj, key) => obj?.[key], item)
                      : item[column.key];

                    const rendered = column.render ? column.render(value, item) : value;

                    return (
                      <div
                        key={column.key as string}
                        className="flex justify-between items-start"
                      >
                        {column.mobileLabel !== false && (
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-2">
                            {column.header}:
                          </span>
                        )}
                        <span
                          className={`text-sm text-gray-900 dark:text-gray-100 ${column.className || ''}`}
                        >
                          {rendered}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className={`bg-gray-50 dark:bg-gray-800 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key as string}
                className={`
                  px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                  ${column.priority === 'low' ? 'hidden lg:table-cell' : ''}
                  ${column.priority === 'medium' ? 'hidden md:table-cell' : ''}
                  ${column.className || ''}
                `}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => {
            const key = keyExtractor(item);
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                className={`
                  ${onRowClick ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : ''}
                  transition-colors
                `}
              >
                {columns.map((column) => {
                  const value = column.key.includes('.')
                    ? column.key.split('.').reduce((obj, key) => obj?.[key], item)
                    : item[column.key];

                  const rendered = column.render ? column.render(value, item) : value;

                  return (
                    <td
                      key={column.key as string}
                      className={`
                        px-6 py-4 whitespace-nowrap text-sm
                        ${column.priority === 'low' ? 'hidden lg:table-cell' : ''}
                        ${column.priority === 'medium' ? 'hidden md:table-cell' : ''}
                        ${column.className || ''}
                      `}
                    >
                      {rendered}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Responsive data list component for simpler use cases
interface DataListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ResponsiveDataList<T>({
  data,
  renderItem,
  keyExtractor,
  loading,
  emptyMessage = 'No items found',
  className = '',
}: DataListProps<T>) {
  const { isMobile } = useResponsive();

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
          ></div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'space-y-3' : 'space-y-2'} ${className}`}>
      {data.map((item, index) => (
        <div key={keyExtractor(item)}>{renderItem(item, index)}</div>
      ))}
    </div>
  );
}

export default ResponsiveTable;
