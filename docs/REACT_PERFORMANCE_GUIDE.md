# React Performance Optimization Guide

This guide documents the performance optimization patterns implemented in the TAAXDOG project.

## Table of Contents
1. [Core Principles](#core-principles)
2. [Component Optimization Patterns](#component-optimization-patterns)
3. [Hook Optimization](#hook-optimization)
4. [State Management](#state-management)
5. [Memoization Strategies](#memoization-strategies)
6. [Code Examples](#code-examples)
7. [Performance Checklist](#performance-checklist)

## Core Principles

### 1. Prevent Unnecessary Re-renders
- Use `React.memo` for functional components
- Implement proper comparison functions when needed
- Extract static components outside of render functions

### 2. Optimize Hook Dependencies
- Use `useCallback` for function props
- Use `useMemo` for expensive computations
- Ensure dependency arrays are complete and minimal

### 3. Component Structure
- Extract sub-components for isolated re-renders
- Move constants outside components
- Group related state together

## Component Optimization Patterns

### Basic Component Structure
```typescript
import React, { useState, useCallback, useMemo, memo } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
interface ComponentProps {
  // Props definition
}

// ============================================================================
// CONSTANTS
// ============================================================================
const STATIC_DATA = ['item1', 'item2'] as const;

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================
const SubComponent = memo<{ prop: string }>(({ prop }) => (
  <div>{prop}</div>
));
SubComponent.displayName = 'SubComponent';

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const MainComponent: React.FC<ComponentProps> = (props) => {
  // ========================================
  // STATE
  // ========================================
  const [state, setState] = useState(initialState);
  
  // ========================================
  // MEMOIZED VALUES
  // ========================================
  const computedValue = useMemo(() => {
    return expensiveComputation(state);
  }, [state]);
  
  // ========================================
  // CALLBACKS
  // ========================================
  const handleClick = useCallback(() => {
    // Handle click
  }, [/* dependencies */]);
  
  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    // Side effects
  }, [/* dependencies */]);
  
  // ========================================
  // RENDER
  // ========================================
  return <div>Component content</div>;
};

MainComponent.displayName = 'MainComponent';

const MemoizedMainComponent = memo(MainComponent);
export default MemoizedMainComponent;
```

## Hook Optimization

### useCallback Pattern
```typescript
// ❌ Bad - Creates new function on every render
const handleSubmit = (data: FormData) => {
  submitForm(data);
};

// ✅ Good - Stable function reference
const handleSubmit = useCallback((data: FormData) => {
  submitForm(data);
}, [submitForm]);
```

### useMemo Pattern
```typescript
// ❌ Bad - Recalculates on every render
const filteredItems = items.filter(item => item.active);

// ✅ Good - Only recalculates when items change
const filteredItems = useMemo(
  () => items.filter(item => item.active),
  [items]
);
```

### Dependency Array Best Practices
```typescript
// ❌ Bad - Missing dependencies
useEffect(() => {
  fetchData(userId);
}, []); // Missing userId

// ✅ Good - All dependencies included
useEffect(() => {
  fetchData(userId);
}, [userId, fetchData]);
```

## State Management

### Group Related State
```typescript
// ❌ Bad - Multiple state updates
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');

// ✅ Good - Single state object
interface FormState {
  name: string;
  email: string;
  phone: string;
}

const [formState, setFormState] = useState<FormState>({
  name: '',
  email: '',
  phone: ''
});

// Update with callback to avoid stale state
const updateField = useCallback((field: keyof FormState, value: string) => {
  setFormState(prev => ({ ...prev, [field]: value }));
}, []);
```

### Lazy Initial State
```typescript
// ❌ Bad - Expensive computation on every render
const [state, setState] = useState(expensiveComputation());

// ✅ Good - Computation only on mount
const [state, setState] = useState(() => expensiveComputation());
```

## Memoization Strategies

### When to Use React.memo
1. **Pure components** that render the same output for the same props
2. **Components that re-render frequently** with the same props
3. **Child components** of frequently updating parents
4. **List items** in large lists

### When NOT to Use React.memo
1. Components that **always receive new props**
2. **Very simple components** (memo overhead might exceed benefit)
3. Components with **children prop** (usually changes every render)

### Custom Comparison Function
```typescript
const MyComponent = memo(
  ({ data, onUpdate }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return (
      prevProps.data.id === nextProps.data.id &&
      prevProps.data.version === nextProps.data.version
    );
  }
);
```

## Code Examples

### Optimized Form Component
```typescript
const OptimizedForm = memo(() => {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<ErrorState>({});
  
  // Memoize validation function
  const validate = useMemo(() => {
    return createValidator(validationRules);
  }, [validationRules]);
  
  // Stable callback for field changes
  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);
  
  // Stable submit handler
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    await submitForm(formData);
  }, [formData, validate]);
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
});
```

### Optimized List Component
```typescript
const ListItem = memo<{ item: Item; onSelect: (id: string) => void }>(
  ({ item, onSelect }) => {
    const handleClick = useCallback(() => {
      onSelect(item.id);
    }, [item.id, onSelect]);
    
    return (
      <div onClick={handleClick}>
        {item.name}
      </div>
    );
  }
);

const OptimizedList = memo(() => {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Stable callback passed to all items
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);
  
  // Memoize filtered/sorted items
  const displayItems = useMemo(() => {
    return items
      .filter(item => item.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);
  
  return (
    <div>
      {displayItems.map(item => (
        <ListItem
          key={item.id}
          item={item}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
});
```

## Performance Checklist

### Component Level
- [ ] Add `React.memo` to components that receive stable props
- [ ] Extract static sub-components outside the main component
- [ ] Move constants and static data outside components
- [ ] Add `displayName` to all memoized components

### State Management
- [ ] Group related state into objects
- [ ] Use lazy initial state for expensive computations
- [ ] Avoid unnecessary state (derive from existing state when possible)
- [ ] Use functional updates to avoid stale closures

### Hooks
- [ ] Wrap event handlers with `useCallback`
- [ ] Wrap expensive computations with `useMemo`
- [ ] Ensure all dependencies are included in arrays
- [ ] Avoid creating objects/arrays in render (use useMemo)

### Props
- [ ] Avoid inline object/array creation
- [ ] Pass stable references (useCallback for functions)
- [ ] Consider prop drilling vs context (context causes more re-renders)
- [ ] Use primitive props when possible (easier to compare)

### Effects
- [ ] Clean up subscriptions and timers
- [ ] Avoid effects that run on every render
- [ ] Split effects by concern (multiple useEffect is fine)
- [ ] Consider if effect is really needed (can derive during render?)

## Common Pitfalls

### 1. Inline Functions in JSX
```typescript
// ❌ Bad
<button onClick={() => handleClick(id)}>Click</button>

// ✅ Good
const handleButtonClick = useCallback(() => {
  handleClick(id);
}, [handleClick, id]);

<button onClick={handleButtonClick}>Click</button>
```

### 2. Object/Array Props
```typescript
// ❌ Bad - New array every render
<Component items={items.filter(i => i.active)} />

// ✅ Good - Stable reference
const activeItems = useMemo(
  () => items.filter(i => i.active),
  [items]
);
<Component items={activeItems} />
```

### 3. Excessive Memoization
```typescript
// ❌ Bad - Over-memoizing simple values
const isEven = useMemo(() => count % 2 === 0, [count]);

// ✅ Good - Direct computation for simple values
const isEven = count % 2 === 0;
```

## Monitoring Performance

### React DevTools Profiler
1. Enable "Record why each component rendered"
2. Look for components rendering frequently
3. Check render duration for expensive components
4. Identify unnecessary renders

### Performance Metrics to Track
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Component render frequency
- Memory usage over time

## Migration Guide

When optimizing existing components:

1. **Profile First**: Use React DevTools to identify problem areas
2. **Start with Parents**: Optimize parent components before children
3. **Measure Impact**: Verify optimizations actually improve performance
4. **Test Thoroughly**: Ensure functionality isn't broken
5. **Document Changes**: Note why specific optimizations were applied

## Conclusion

Performance optimization is an iterative process. Not every component needs every optimization. Focus on:
- Components that render frequently
- Components with expensive computations
- Components in critical user paths

Always measure before and after optimization to ensure improvements are real and meaningful.