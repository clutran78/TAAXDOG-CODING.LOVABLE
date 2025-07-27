# React Component Patterns Guide

This guide defines the standard patterns that all React components in the TAAXDOG project should follow for consistency and maintainability.

## Table of Contents
1. [Component Structure](#component-structure)
2. [TypeScript Patterns](#typescript-patterns)
3. [Hook Usage](#hook-usage)
4. [Event Handlers](#event-handlers)
5. [State Management](#state-management)
6. [Loading & Error States](#loading--error-states)
7. [Conditional Rendering](#conditional-rendering)
8. [Performance Optimization](#performance-optimization)

## Component Structure

All components should follow this consistent structure:

```tsx
"use client"; // Only if needed

import React, { useState, useEffect, useCallback, useMemo } from "react";
// External imports first
// Internal imports second
// Types/interfaces last

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ComponentNameProps {
  // Required props first
  id: string;
  title: string;
  
  // Optional props after
  description?: string;
  
  // Callbacks (always prefixed with 'on')
  onSave?: (value: any) => void;
  onCancel?: () => void;
  
  // Children last
  children?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ComponentName: React.FC<ComponentNameProps> = ({
  // Destructure all props
  id,
  title,
  description,
  onSave,
  onCancel,
  children
}) => {
  // ========================================
  // HOOKS (in consistent order)
  // ========================================
  
  const router = useRouter(); // Navigation hooks
  const { data } = useCustomHook(); // Custom hooks
  
  // ========================================
  // STATE
  // ========================================
  
  // Group related state together
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ========================================
  // REFS
  // ========================================
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // ========================================
  // COMPUTED VALUES
  // ========================================
  
  const isValid = useMemo(() => {
    // Expensive computations here
    return someCondition;
  }, [dependency]);
  
  // ========================================
  // EFFECTS
  // ========================================
  
  useEffect(() => {
    // Always use cleanup pattern
    let mounted = true;
    
    const fetchData = async () => {
      if (!mounted) return;
      // Async operations
    };
    
    fetchData();
    
    return () => {
      mounted = false;
    };
  }, [dependencies]);
  
  // ========================================
  // EVENT HANDLERS (prefix with 'handle')
  // ========================================
  
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    // Handler logic
  }, [dependencies]);
  
  // ========================================
  // RENDER HELPERS
  // ========================================
  
  const renderContent = () => {
    // Complex rendering logic
  };
  
  // ========================================
  // MAIN RENDER
  // ========================================
  
  // Early returns for edge cases
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
```

## TypeScript Patterns

### 1. Always Define Props Interface
```tsx
interface ButtonProps {
  variant: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  onClick: () => void;
  children: React.ReactNode;
}
```

### 2. Use React.FC for Functional Components
```tsx
const Button: React.FC<ButtonProps> = ({ variant, size = "medium", onClick, children }) => {
  // Component logic
};
```

### 3. Type Event Handlers Properly
```tsx
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};
```

## Hook Usage

### 1. Consistent Hook Order
Always use hooks in this order:
1. Router/Navigation hooks
2. Context hooks
3. Redux/Store hooks
4. Custom hooks
5. State hooks
6. Effect hooks
7. Callback/Memo hooks

### 2. Custom Hook Pattern
```tsx
// hooks/useApiData.ts
export const useApiData = <T>(endpoint: string) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    // Fetch logic
  }, [endpoint]);
  
  return { data, isLoading, error };
};
```

## Event Handlers

### 1. Naming Convention
Always prefix event handlers with "handle":
- `handleClick`
- `handleSubmit`
- `handleChange`
- `handleKeyPress`

### 2. Use useCallback for Optimization
```tsx
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

### 3. Prevent Default Consistently
```tsx
const handleSubmit = useCallback((e: FormEvent) => {
  e.preventDefault();
  // Form submission logic
}, []);
```

## State Management

### 1. Group Related State
```tsx
// Good
const [user, setUser] = useState({ name: "", email: "" });

// Avoid
const [userName, setUserName] = useState("");
const [userEmail, setUserEmail] = useState("");
```

### 2. Use Descriptive State Names
```tsx
// Good
const [isModalOpen, setIsModalOpen] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);

// Avoid
const [open, setOpen] = useState(false);
const [loading, setLoading] = useState(false);
```

## Loading & Error States

### 1. Standard Loading Component
```tsx
const LoadingSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    {message && <p className="ml-3 text-gray-600">{message}</p>}
  </div>
);
```

### 2. Standard Error Component
```tsx
const ErrorDisplay: React.FC<{ error: Error | string; onRetry?: () => void }> = ({ 
  error, 
  onRetry 
}) => (
  <div className="bg-red-50 border border-red-200 rounded-md p-4">
    <p className="text-red-700">
      {error instanceof Error ? error.message : error}
    </p>
    {onRetry && (
      <button onClick={onRetry} className="mt-2 text-red-600">
        Try again
      </button>
    )}
  </div>
);
```

### 3. Empty State Component
```tsx
const EmptyState: React.FC<{ title: string; description?: string }> = ({ 
  title, 
  description 
}) => (
  <div className="text-center py-12">
    <h3 className="text-lg font-medium text-gray-900">{title}</h3>
    {description && <p className="text-gray-500 mt-2">{description}</p>}
  </div>
);
```

## Conditional Rendering

### 1. Early Returns for Edge Cases
```tsx
const Component: React.FC = () => {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!data) return <EmptyState title="No data" />;
  
  return <div>{/* Main content */}</div>;
};
```

### 2. Conditional Rendering in JSX
```tsx
return (
  <div>
    {/* Simple conditions */}
    {isVisible && <Component />}
    
    {/* With else */}
    {condition ? <ComponentA /> : <ComponentB />}
    
    {/* Multiple conditions */}
    {(() => {
      if (status === "loading") return <Loading />;
      if (status === "error") return <Error />;
      return <Success />;
    })()}
  </div>
);
```

## Performance Optimization

### 1. Use useMemo for Expensive Computations
```tsx
const expensiveValue = useMemo(() => {
  return items.reduce((sum, item) => sum + item.value, 0);
}, [items]);
```

### 2. Use useCallback for Event Handlers
```tsx
const handleClick = useCallback((id: string) => {
  // Handler logic
}, [dependencies]);
```

### 3. Lazy Load Components
```tsx
const HeavyComponent = lazy(() => import("./HeavyComponent"));

// In render
<Suspense fallback={<LoadingSpinner />}>
  <HeavyComponent />
</Suspense>
```

### 4. Virtualize Long Lists
```tsx
import { FixedSizeList } from "react-window";

const VirtualList: React.FC<{ items: Item[] }> = ({ items }) => (
  <FixedSizeList
    height={600}
    itemCount={items.length}
    itemSize={50}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        {items[index].name}
      </div>
    )}
  </FixedSizeList>
);
```

## Best Practices Summary

1. **Consistent Structure**: Follow the defined component structure
2. **Type Safety**: Always use TypeScript interfaces and proper typing
3. **Performance**: Use React optimization hooks appropriately
4. **Accessibility**: Include proper ARIA attributes and keyboard navigation
5. **Error Handling**: Always handle loading and error states
6. **Clean Code**: Use descriptive names and avoid magic numbers/strings
7. **Reusability**: Create reusable components for common patterns
8. **Testing**: Write components with testing in mind

## Examples

Check these standardized components for reference:
- `/components/auth/login.tsx` - Authentication form with validation
- `/components/dashboard/Dashboard.tsx` - Dashboard with loading states
- `/components/ui/StandardModal.tsx` - Reusable modal component
- `/components/ui/StandardForm.tsx` - Generic form component
- `/components/patterns/ComponentPatterns.tsx` - Pattern examples