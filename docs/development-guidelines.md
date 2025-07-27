# TAAXDOG Development Guidelines

## Table of Contents

1. [Introduction](#introduction)
2. [Naming Conventions](#naming-conventions)
3. [File Organization](#file-organization)
4. [TypeScript Guidelines](#typescript-guidelines)
5. [React Best Practices](#react-best-practices)
6. [API Development Standards](#api-development-standards)
7. [Database Patterns](#database-patterns)
8. [Error Handling](#error-handling)
9. [Security Guidelines](#security-guidelines)
10. [Performance Best Practices](#performance-best-practices)
11. [Testing Standards](#testing-standards)
12. [Common Pitfalls](#common-pitfalls)
13. [Code Review Checklist](#code-review-checklist)

## Introduction

This document establishes coding standards and best practices for the TAAXDOG project. Following these guidelines ensures consistency, maintainability, and quality across the codebase.

### Core Principles

1. **Clarity over Cleverness**: Write code that is easy to understand
2. **Type Safety**: Leverage TypeScript to prevent runtime errors
3. **Consistency**: Follow established patterns throughout the codebase
4. **Security First**: Consider security implications in every feature
5. **Performance Matters**: Optimize for user experience

## Naming Conventions

### Files and Directories

#### ✅ Correct Examples

```
components/
├── auth/
│   ├── LoginForm.tsx         # Component files: PascalCase
│   ├── LoginForm.test.tsx    # Test files: ComponentName.test.tsx
│   ├── types.ts              # Type definitions: lowercase
│   └── index.ts              # Barrel exports: lowercase
├── hooks/
│   ├── useAuth.ts            # Hooks: camelCase with 'use' prefix
│   └── useAuth.test.ts
└── utils/
    ├── formatCurrency.ts     # Utilities: camelCase
    └── constants.ts          # Constants file: lowercase
```

#### ❌ Incorrect Examples

```
components/
├── Auth/                     # ❌ Directory should be lowercase
│   ├── login-form.tsx        # ❌ Component should be PascalCase
│   ├── LoginFormTests.tsx    # ❌ Test file should be .test.tsx
│   └── TYPES.ts              # ❌ Regular files shouldn't be uppercase
└── Hooks/                    # ❌ Directory should be lowercase
    └── UseAuth.ts            # ❌ Hook file should be camelCase
```

### Variables and Functions

#### ✅ Correct Examples

```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.taxreturnpro.com.au';

// Variables: camelCase
const userProfile = await fetchUserProfile();
const isAuthenticated = checkAuth();

// Functions: camelCase
function calculateGST(amount: number): number {
  return amount * 0.1;
}

// Boolean variables: is/has/should prefix
const isLoading = true;
const hasPermission = false;
const shouldRefetch = true;

// Arrays: plural names
const transactions = [];
const userRoles = ['USER', 'ADMIN'];

// Event handlers: handle prefix
const handleSubmit = (event: FormEvent) => {};
const handleClick = () => {};
```

#### ❌ Incorrect Examples

```typescript
// ❌ Wrong constant naming
const maxRetryAttempts = 3;          // Should be UPPER_SNAKE_CASE
const api_base_url = 'https://...'; // Should be UPPER_SNAKE_CASE

// ❌ Wrong variable naming
const UserProfile = {};              // Should be camelCase
const is_authenticated = true;       // Should be camelCase

// ❌ Wrong function naming
function CalculateGST() {}           // Should be camelCase
function calculate_gst() {}          // Should be camelCase

// ❌ Poor boolean naming
const loading = true;                // Should have is/has prefix
const permission = false;            // Should have has prefix

// ❌ Poor array naming
const transaction = [];              // Should be plural
const user_role = [];                // Should be camelCase and plural

// ❌ Poor event handler naming
const submit = () => {};             // Should have handle prefix
const onClick = () => {};            // Should be handleClick
```

### Types and Interfaces

#### ✅ Correct Examples

```typescript
// Interfaces: PascalCase, no 'I' prefix
interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
}

// Type aliases: PascalCase
type UserRole = 'USER' | 'ADMIN' | 'ACCOUNTANT';

// Enums: PascalCase with UPPER_SNAKE_CASE values
enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Generic types: Single letter or descriptive
type ApiResponse<T> = {
  data: T;
  error?: string;
};

// Props interfaces: ComponentName + Props
interface LoginFormProps {
  onSubmit: (data: LoginData) => void;
  disabled?: boolean;
}
```

#### ❌ Incorrect Examples

```typescript
// ❌ Wrong interface naming
interface IUserProfile {}            // No 'I' prefix
interface user_profile {}            // Should be PascalCase

// ❌ Wrong type naming
type userRole = 'USER' | 'ADMIN';   // Should be PascalCase

// ❌ Wrong enum naming
enum transactionStatus {}            // Should be PascalCase
enum TransactionStatus {
  pending = 'pending',               // Values should be UPPER_SNAKE_CASE
}

// ❌ Wrong props naming
interface LoginFormProperties {}     // Should be LoginFormProps
interface Props {}                   // Too generic
```

## File Organization

### Component Structure

#### ✅ Correct Component File Structure

```typescript
// components/auth/LoginForm.tsx

import React, { useState, useCallback, memo } from 'react';
import { useRouter } from 'next/router';

// External imports first
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

// Types
import type { LoginFormProps } from './types';

// Styles (if using CSS modules)
import styles from './LoginForm.module.css';

// Component definition
export const LoginForm = memo<LoginFormProps>(({ 
  onSuccess,
  redirectUrl = '/dashboard' 
}) => {
  // State hooks
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Custom hooks
  const router = useRouter();
  const { login, isLoading } = useAuth();
  
  // Callbacks
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login({ email, password });
      onSuccess?.();
      router.push(redirectUrl);
    } catch (error) {
      setErrors({ form: 'Invalid credentials' });
    }
  }, [email, password, login, onSuccess, redirectUrl, router]);
  
  // Render
  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Component JSX */}
    </form>
  );
});

LoginForm.displayName = 'LoginForm';
```

#### ❌ Incorrect Component Structure

```typescript
// ❌ Poor organization
import styles from './styles.css';
import React from 'react';
import { login } from '@/api';  // Direct API import in component

// ❌ No type safety
export function LoginForm(props) {
  // ❌ No proper state management
  let email = '';
  let password = '';
  
  // ❌ API calls directly in component
  const handleSubmit = () => {
    fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  };
  
  return <form>...</form>;
}
```

### API Route Structure

#### ✅ Correct API Route Pattern

```typescript
// pages/api/users/[id].ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { withMiddleware } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/lib/services/user-service';
import { ApiError, ApiResponse } from '@/lib/types';

// Validation schemas
const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

// Handler function
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse | ApiError>
) {
  const { method, query, body } = req;
  const userId = query.id as string;
  
  try {
    switch (method) {
      case 'GET':
        const user = await UserService.findById(userId);
        return res.status(200).json({ success: true, data: user });
        
      case 'PUT':
        const validatedData = updateUserSchema.parse(body);
        const updated = await UserService.update(userId, validatedData);
        return res.status(200).json({ success: true, data: updated });
        
      case 'DELETE':
        await UserService.delete(userId);
        return res.status(204).end();
        
      default:
        return res.status(405).json({ 
          success: false, 
          error: 'Method not allowed' 
        });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

// Export with middleware
export default withMiddleware(handler, {
  auth: true,
  methods: ['GET', 'PUT', 'DELETE'],
  rateLimit: {
    window: '1m',
    max: 10
  }
});
```

## TypeScript Guidelines

### Type Definitions

#### ✅ Correct Type Usage

```typescript
// Prefer interfaces for objects
interface User {
  id: string;
  email: string;
  profile: UserProfile;
}

// Use type for unions, intersections, and aliases
type UserRole = 'USER' | 'ADMIN' | 'ACCOUNTANT';
type ID = string | number;
type PartialUser = Partial<User>;

// Avoid any - use unknown or generic types
function processData<T>(data: T): T {
  return data;
}

// Use proper return types
async function fetchUser(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('User not found');
  return user;
}

// Use const assertions for literals
const ROLES = ['USER', 'ADMIN', 'ACCOUNTANT'] as const;
type Role = typeof ROLES[number];

// Discriminated unions for complex types
type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

#### ❌ Incorrect Type Usage

```typescript
// ❌ Using any
function processData(data: any) {  // Use generic or unknown
  return data;
}

// ❌ Missing return types
async function fetchUser(id: string) {  // Should specify Promise<User>
  return await prisma.user.findUnique({ where: { id } });
}

// ❌ Using type for objects (prefer interface)
type User = {
  id: string;
  email: string;
};

// ❌ Overly broad types
function calculate(value: any): any {  // Too permissive
  return value * 2;
}

// ❌ Not using const assertions
const ROLES = ['USER', 'ADMIN'];  // Type is string[]
type Role = typeof ROLES[number];  // Type is string (too broad)
```

## React Best Practices

### Component Patterns

#### ✅ Correct React Patterns

```typescript
// Use functional components with hooks
export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const { data, loading, error } = useUser(userId);
  
  if (loading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!data) return null;
  
  return <ProfileDisplay user={data} />;
};

// Memoize expensive computations
const ExpensiveComponent: React.FC<Props> = ({ data }) => {
  const processedData = useMemo(() => 
    expensiveCalculation(data), 
    [data]
  );
  
  return <DataDisplay data={processedData} />;
};

// Use callback for stable function references
const FormComponent: React.FC = () => {
  const [value, setValue] = useState('');
  
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);
  
  return <input value={value} onChange={handleChange} />;
};

// Proper effect cleanup
const DataFetcher: React.FC<{ id: string }> = ({ id }) => {
  useEffect(() => {
    const controller = new AbortController();
    
    fetchData(id, { signal: controller.signal })
      .then(setData)
      .catch(handleError);
    
    return () => controller.abort();
  }, [id]);
  
  return <div>...</div>;
};
```

#### ❌ Incorrect React Patterns

```typescript
// ❌ Class components (use functional)
class UserProfile extends React.Component {
  render() {
    return <div>...</div>;
  }
}

// ❌ Direct DOM manipulation
const BadComponent = () => {
  useEffect(() => {
    document.getElementById('myDiv').innerHTML = 'Hello';  // Use React state
  }, []);
  
  return <div id="myDiv" />;
};

// ❌ Missing dependencies in hooks
const DataFetcher = ({ id, filter }) => {
  useEffect(() => {
    fetchData(id, filter);
  }, [id]);  // Missing 'filter' dependency
  
  return <div>...</div>;
};

// ❌ Inline function definitions
const ListComponent = ({ items }) => {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => handleClick(item)}>  // Creates new function each render
          {item.name}
        </li>
      ))}
    </ul>
  );
};
```

## API Development Standards

### Request/Response Format

#### ✅ Correct API Patterns

```typescript
// Standardized response format
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// Consistent error responses
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

// Proper validation
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

// Middleware composition
export default withMiddleware(handler, {
  auth: true,
  validate: createUserSchema,
  rateLimit: { window: '1m', max: 5 }
});

// Proper HTTP status codes
res.status(200).json({ success: true, data: user });        // OK
res.status(201).json({ success: true, data: created });     // Created
res.status(204).end();                                      // No Content
res.status(400).json({ success: false, error: 'Bad Request' });
res.status(401).json({ success: false, error: 'Unauthorized' });
res.status(403).json({ success: false, error: 'Forbidden' });
res.status(404).json({ success: false, error: 'Not Found' });
res.status(500).json({ success: false, error: 'Server Error' });
```

#### ❌ Incorrect API Patterns

```typescript
// ❌ Inconsistent response formats
res.json({ user });           // Sometimes just data
res.json({ error: 'Failed' }); // Sometimes error
res.json({ status: 'ok', user }); // Different structure

// ❌ Wrong status codes
res.status(200).json({ error: 'Not found' });  // Should be 404
res.status(500).json({ data: user });          // 500 for success?

// ❌ No validation
const { email, password } = req.body;  // Direct use without validation

// ❌ Exposing internal errors
catch (error) {
  res.status(500).json({ error: error.stack });  // Exposes internals
}
```

## Database Patterns

### Query Optimization

#### ✅ Correct Database Patterns

```typescript
// Select only needed fields
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    profile: {
      select: {
        name: true,
        avatar: true
      }
    }
  }
});

// Use transactions for related operations
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  const profile = await tx.profile.create({ 
    data: { ...profileData, userId: user.id } 
  });
  return { user, profile };
});

// Proper pagination
const users = await prisma.user.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: 'desc' }
});

// Use indexes for frequent queries
// In schema.prisma:
// @@index([email])
// @@index([createdAt, status])
```

#### ❌ Incorrect Database Patterns

```typescript
// ❌ Fetching unnecessary data
const users = await prisma.user.findMany();  // Gets all fields

// ❌ N+1 queries
const users = await prisma.user.findMany();
for (const user of users) {
  const profile = await prisma.profile.findUnique({  // N+1 problem
    where: { userId: user.id }
  });
}

// ❌ No error handling
const user = await prisma.user.create({ data });  // What if it fails?

// ❌ Unbounded queries
const allUsers = await prisma.user.findMany();  // No limit
```

## Error Handling

### Error Handling Patterns

#### ✅ Correct Error Handling

```typescript
// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public fields: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Try-catch with proper error handling
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  if (error instanceof ValidationError) {
    return { success: false, error: error.message, fields: error.fields };
  }
  
  if (error instanceof AuthenticationError) {
    res.status(401).json({ success: false, error: error.message });
    return;
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error);
  return { success: false, error: 'An unexpected error occurred' };
}

// React error boundaries
export class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React error:', error, errorInfo);
    // Send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorDisplay error={this.state.error} />;
    }
    
    return this.props.children;
  }
}
```

#### ❌ Incorrect Error Handling

```typescript
// ❌ Catching without handling
try {
  await riskyOperation();
} catch (error) {
  // Silent failure
}

// ❌ Generic error messages
catch (error) {
  return { error: 'Error occurred' };  // Not helpful
}

// ❌ Exposing sensitive information
catch (error) {
  return { error: error.stack };  // Exposes internals
}

// ❌ Not distinguishing error types
catch (error) {
  res.status(500).json({ error: error.message });  // All errors = 500?
}
```

## Security Guidelines

### Security Best Practices

#### ✅ Secure Patterns

```typescript
// Input validation
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

const schema = z.object({
  email: z.string().email(),
  content: z.string().transform(val => DOMPurify.sanitize(val))
});

// SQL injection prevention (Prisma handles this)
const user = await prisma.user.findFirst({
  where: { 
    email: userInput  // Parameterized, safe
  }
});

// Authentication checks
if (!req.session?.userId) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100  // limit each IP to 100 requests per windowMs
});

// CSRF protection
const csrfToken = generateCSRFToken();
res.setHeader('X-CSRF-Token', csrfToken);

// Secure headers
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
```

#### ❌ Insecure Patterns

```typescript
// ❌ No input validation
const { email, password } = req.body;
await createUser(email, password);  // Direct use

// ❌ SQL injection vulnerable
const query = `SELECT * FROM users WHERE email = '${userInput}'`;  // Never do this

// ❌ Exposed sensitive data
res.json({ user: { ...userData, password: hashedPassword } });  // Don't send passwords

// ❌ No authentication
export default async function handler(req, res) {
  const users = await prisma.user.findMany();  // No auth check
  res.json(users);
}

// ❌ Storing sensitive data in code
const API_KEY = 'sk_live_abcd1234';  // Use environment variables
```

## Performance Best Practices

### Optimization Patterns

#### ✅ Performance Optimizations

```typescript
// Lazy loading components
const HeavyComponent = lazy(() => import('@/components/HeavyComponent'));

// Memoization
const MemoizedComponent = memo(({ data }) => {
  const processed = useMemo(() => expensiveOperation(data), [data]);
  return <div>{processed}</div>;
});

// Debouncing
const SearchInput = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  
  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery);
    }
  }, [debouncedQuery]);
  
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
};

// Image optimization
import Image from 'next/image';

<Image 
  src="/hero.jpg" 
  alt="Hero" 
  width={1200} 
  height={600}
  priority
  placeholder="blur"
/>

// API response caching
export default withCache(handler, {
  ttl: 60 * 5,  // 5 minutes
  key: (req) => `user:${req.query.id}`
});
```

#### ❌ Performance Anti-patterns

```typescript
// ❌ Unnecessary re-renders
const Component = ({ data }) => {
  const config = { threshold: 0.5 };  // Creates new object every render
  return <Child config={config} />;
};

// ❌ Large bundle imports
import _ from 'lodash';  // Imports entire library
const result = _.get(obj, 'path.to.value');

// ❌ Synchronous heavy operations
const Component = ({ data }) => {
  const result = heavyCalculation(data);  // Blocks render
  return <div>{result}</div>;
};

// ❌ Missing keys in lists
items.map(item => <Item data={item} />);  // No key prop

// ❌ Inefficient queries
const users = await prisma.user.findMany({
  include: { 
    posts: true,      // Getting all data
    comments: true,   // even if not needed
    profile: true 
  }
});
```

## Testing Standards

### Test Patterns

#### ✅ Good Test Patterns

```typescript
// Descriptive test names
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      const userData = { email: 'test@example.com', name: 'Test User' };
      const user = await UserService.createUser(userData);
      
      expect(user).toMatchObject(userData);
      expect(user.id).toBeDefined();
    });
    
    it('should throw ValidationError for invalid email', async () => {
      const userData = { email: 'invalid', name: 'Test User' };
      
      await expect(UserService.createUser(userData))
        .rejects
        .toThrow(ValidationError);
    });
  });
});

// Component testing
describe('LoginForm', () => {
  it('should call onSubmit with form data', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByRole } = render(
      <LoginForm onSubmit={onSubmit} />
    );
    
    await userEvent.type(getByLabelText('Email'), 'test@example.com');
    await userEvent.type(getByLabelText('Password'), 'password123');
    await userEvent.click(getByRole('button', { name: 'Login' }));
    
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});

// API testing
describe('GET /api/users/:id', () => {
  it('should return user data for valid ID', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'user123' }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toMatchObject({
      success: true,
      data: { id: 'user123' }
    });
  });
});
```

#### ❌ Poor Test Patterns

```typescript
// ❌ Non-descriptive test names
it('test 1', () => {
  // ...
});

it('works', () => {
  // ...
});

// ❌ Testing implementation details
it('should call useState', () => {
  const { result } = renderHook(() => useCustomHook());
  expect(useState).toHaveBeenCalled();  // Testing React internals
});

// ❌ No assertions
it('should not throw', () => {
  const result = someFunction();  // No expect statements
});

// ❌ Overly complex tests
it('should do everything', async () => {
  // 100 lines of test code
  // Testing multiple behaviors
  // Hard to understand what failed
});
```

## Common Pitfalls

### Pitfalls to Avoid

#### 1. State Management Pitfalls

```typescript
// ❌ Mutating state directly
const [user, setUser] = useState({ name: 'John' });
user.name = 'Jane';  // Direct mutation
setUser(user);       // React won't re-render

// ✅ Create new object
setUser({ ...user, name: 'Jane' });
// or
setUser(prev => ({ ...prev, name: 'Jane' }));

// ❌ Async state updates without cleanup
useEffect(() => {
  fetchData().then(setData);  // Might set state after unmount
}, []);

// ✅ Cleanup async operations
useEffect(() => {
  let mounted = true;
  
  fetchData().then(data => {
    if (mounted) setData(data);
  });
  
  return () => { mounted = false; };
}, []);
```

#### 2. Performance Pitfalls

```typescript
// ❌ Creating functions in render
<button onClick={() => handleClick(item.id)}>  // New function each render

// ✅ Use callback
const handleItemClick = useCallback((id: string) => {
  // handle click
}, []);

// ❌ Expensive operations in render
const Component = ({ data }) => {
  const sorted = data.sort((a, b) => b.value - a.value);  // Sorts on every render
  return <List items={sorted} />;
};

// ✅ Memoize expensive operations
const sorted = useMemo(
  () => [...data].sort((a, b) => b.value - a.value),
  [data]
);
```

#### 3. TypeScript Pitfalls

```typescript
// ❌ Using 'any' type
function process(data: any) {
  return data.value;  // No type safety
}

// ✅ Use proper types or generics
function process<T extends { value: string }>(data: T) {
  return data.value;  // Type safe
}

// ❌ Type assertions without checks
const user = {} as User;  // Dangerous assertion

// ✅ Type guards
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj
  );
}
```

#### 4. API Design Pitfalls

```typescript
// ❌ Inconsistent naming
GET /api/getUsers
POST /api/create-user
PUT /api/update_USER

// ✅ RESTful conventions
GET /api/users
POST /api/users
PUT /api/users/:id

// ❌ Exposing database structure
res.json({
  _id: user._id,
  password_hash: user.password_hash,
  created_at: user.created_at
});

// ✅ Transform data for API
res.json({
  id: user._id.toString(),
  createdAt: user.created_at.toISOString()
  // Omit sensitive fields
});
```

## Code Review Checklist

### Before Submitting PR

- [ ] **Code Quality**
  - [ ] No ESLint warnings or errors
  - [ ] Prettier formatting applied
  - [ ] TypeScript compiles without errors
  - [ ] No `console.log` statements (except for errors)
  - [ ] No commented-out code
  - [ ] No `TODO` comments without issue numbers

- [ ] **Naming Conventions**
  - [ ] Components use PascalCase
  - [ ] Files follow naming conventions
  - [ ] Variables and functions use camelCase
  - [ ] Constants use UPPER_SNAKE_CASE

- [ ] **Type Safety**
  - [ ] No `any` types
  - [ ] All functions have return types
  - [ ] Props interfaces are defined
  - [ ] No type assertions without validation

- [ ] **Security**
  - [ ] Input validation on all user data
  - [ ] No sensitive data in responses
  - [ ] Authentication checks on protected routes
  - [ ] No hardcoded secrets or API keys

- [ ] **Performance**
  - [ ] Large components are lazy loaded
  - [ ] Expensive computations are memoized
  - [ ] Database queries are optimized
  - [ ] No N+1 query problems

- [ ] **Testing**
  - [ ] New features have tests
  - [ ] All tests pass
  - [ ] Coverage hasn't decreased
  - [ ] Edge cases are tested

- [ ] **Documentation**
  - [ ] Complex functions have JSDoc comments
  - [ ] README updated if needed
  - [ ] API changes documented
  - [ ] Breaking changes noted

### During Code Review

1. **Readability**: Can you understand the code without extensive comments?
2. **Maintainability**: Will this code be easy to modify in the future?
3. **Efficiency**: Are there any obvious performance improvements?
4. **Security**: Are there any security vulnerabilities?
5. **Consistency**: Does the code follow project patterns?
6. **Error Handling**: Are errors handled appropriately?
7. **Testing**: Are the tests comprehensive and meaningful?

## Conclusion

Following these guidelines ensures that the TAAXDOG codebase remains clean, maintainable, and scalable. When in doubt:

1. **Be consistent** - Follow existing patterns in the codebase
2. **Be explicit** - Clear code is better than clever code
3. **Be secure** - Always consider security implications
4. **Be tested** - Write tests for your code
5. **Be documented** - Document complex logic and decisions

Remember: Code is read far more often than it is written. Write code for your future self and your teammates.