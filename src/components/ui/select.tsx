import * as React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export const SelectTrigger = ({ children, className, ...props }: any) => (
  <div
    className={`flex items-center justify-between ${className || ''}`}
    {...props}
  >
    {children}
  </div>
);

export const SelectValue = ({ placeholder, ...props }: any) => (
  <span {...props}>{placeholder}</span>
);

export const SelectContent = ({ children, ...props }: any) => <div {...props}>{children}</div>;

export const SelectItem = ({ value, children, ...props }: any) => (
  <option
    value={value}
    {...props}
  >
    {children}
  </option>
);
