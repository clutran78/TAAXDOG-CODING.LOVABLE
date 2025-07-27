# TAAXDOG Design System

## Overview
This document outlines the design system for the TAAXDOG application, ensuring consistent UI/UX across all components.

## Design Principles
1. **Clarity**: Clear visual hierarchy and readable typography
2. **Consistency**: Unified patterns across all components
3. **Accessibility**: WCAG 2.1 AA compliant
4. **Responsiveness**: Mobile-first design approach
5. **Performance**: Optimized for fast load times

## Color Palette

### Primary Colors
- **Primary**: Blue-600 (#2563EB) - Main actions, links
- **Primary Dark**: Blue-700 (#1D4ED8) - Hover states
- **Primary Light**: Blue-500 (#3B82F6) - Active states

### Semantic Colors
- **Success**: Green-600 (#16A34A) - Positive actions/states
- **Danger**: Red-600 (#DC2626) - Errors, destructive actions
- **Warning**: Amber-600 (#D97706) - Warnings, cautions
- **Info**: Sky-600 (#0284C7) - Informational content

### Neutral Colors
- **Gray-50** to **Gray-900**: Text, borders, backgrounds
- **White**: Primary background
- **Black**: High contrast text

### Dark Mode
All colors have dark mode variants optimized for contrast and readability.

## Typography

### Font Family
- **Sans**: Inter (primary), system fonts fallback
- **Mono**: Fira Code (code, numbers), monospace fallback

### Font Sizes
- **xs**: 0.75rem (12px)
- **sm**: 0.875rem (14px)
- **base**: 1rem (16px)
- **lg**: 1.125rem (18px)
- **xl**: 1.25rem (20px)
- **2xl**: 1.5rem (24px)
- **3xl**: 1.875rem (30px)
- **4xl**: 2.25rem (36px)

### Font Weights
- **Normal**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700

## Spacing System
Based on 4px grid:
- **0.5**: 2px
- **1**: 4px
- **2**: 8px
- **3**: 12px
- **4**: 16px
- **5**: 20px
- **6**: 24px
- **8**: 32px
- **10**: 40px
- **12**: 48px
- **16**: 64px

## Components

### Buttons
```tsx
import { Button } from '@/components/ui/Button';

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="success">Success</Button>
<Button variant="danger">Danger</Button>
<Button variant="warning">Warning</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>

// States
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>

// With Icons
<Button leftIcon={<Icon />}>With Icon</Button>
```

### Cards
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

<Card variant="default">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

### Form Inputs
```tsx
import { Input, Textarea } from '@/components/ui/Input';

<Input 
  label="Email" 
  type="email"
  placeholder="Enter email"
  error="Invalid email"
  required
/>

<Textarea 
  label="Description"
  rows={4}
  hint="Max 500 characters"
/>
```

### Badges
```tsx
import { Badge, StatusBadge, CountBadge } from '@/components/ui/Badge';

<Badge variant="primary">New</Badge>
<StatusBadge status="online">Active</StatusBadge>
<CountBadge count={42} />
```

## Layout Patterns

### Container Widths
- **Narrow**: max-w-4xl (896px)
- **Default**: max-w-6xl (1152px)
- **Wide**: max-w-7xl (1280px)

### Grid System
- Mobile: 1 column
- Tablet (768px+): 2 columns
- Desktop (1024px+): 3-4 columns

### Card Grid
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}
```

## Animation & Transitions

### Standard Transitions
- **Duration**: 200ms
- **Timing**: ease-in-out
- **Properties**: colors, shadows, transforms

### Loading States
- Skeleton screens for content loading
- Spinner for actions
- Progress bars for multi-step processes

## Responsive Breakpoints
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

## Dark Mode
- Automatic based on system preference
- Manual toggle available
- Optimized color contrast
- Consistent component appearance

## Accessibility Guidelines
1. All interactive elements have focus states
2. Proper ARIA labels and roles
3. Keyboard navigation support
4. Screen reader friendly
5. Color contrast ratios meet WCAG standards

## Implementation Checklist

### For New Components
- [ ] Use design system colors
- [ ] Apply consistent spacing
- [ ] Include dark mode support
- [ ] Add proper TypeScript types
- [ ] Include accessibility features
- [ ] Test responsive behavior
- [ ] Document usage examples

### For Existing Components
- [ ] Replace inline styles with design tokens
- [ ] Update to use UI components
- [ ] Ensure dark mode compatibility
- [ ] Add missing accessibility features
- [ ] Test across breakpoints

## Usage Examples

### Dashboard Card
```tsx
<Card variant="elevated" hover>
  <CardHeader>
    <CardTitle>Total Balance</CardTitle>
    <CardDescription>As of {date}</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
      ${balance}
    </div>
    <Badge variant="success" size="sm">
      +2.5%
    </Badge>
  </CardContent>
</Card>
```

### Form Example
```tsx
<form className="space-y-4">
  <Input 
    label="Amount"
    type="number"
    leftIcon={<DollarIcon />}
    placeholder="0.00"
    required
  />
  
  <Input
    label="Description"
    placeholder="What's this for?"
  />
  
  <div className="flex gap-3">
    <Button type="submit" variant="primary">
      Save
    </Button>
    <Button type="button" variant="secondary">
      Cancel
    </Button>
  </div>
</form>
```

## Migration Guide

### Old Button → New Button
```tsx
// Old
<button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  Click me
</button>

// New
<Button variant="primary">Click me</Button>
```

### Old Card → New Card
```tsx
// Old
<div className="bg-white rounded-lg shadow p-6">
  <h3 className="text-lg font-semibold">Title</h3>
  <p>Content</p>
</div>

// New
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Content</p>
  </CardContent>
</Card>
```

### Old Input → New Input
```tsx
// Old
<input 
  type="text" 
  className="w-full px-3 py-2 border rounded-md focus:ring-2"
/>

// New
<Input placeholder="Enter text" />
```