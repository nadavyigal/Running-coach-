# React Component Patterns Guide

**Created:** July 24, 2025  
**Last Updated:** July 24, 2025  
**Status:** Epic 8.4 Implementation - Code Quality Standards  

## Overview

This document establishes consistent patterns for React components in the Running Coach application to ensure maintainability, type safety, and developer productivity.

## Standard Component Structure

### Base Component Pattern

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ComponentErrorBoundary } from '@/components/error-boundaries';
import { cn } from '@/lib/utils';

/**
 * Interface for component props with comprehensive documentation
 */
interface ComponentNameProps {
  /** Required data with proper typing */
  data: TypedData;
  
  /** Optional callback with error handling */
  onAction?: (result: ActionResult) => void;
  
  /** Loading state for async operations */
  isLoading?: boolean;
  
  /** Error state for error handling */
  error?: Error | null;
  
  /** CSS class name for styling flexibility */
  className?: string;
  
  /** Children for composition patterns */
  children?: React.ReactNode;
}

/**
 * ComponentName provides [clear description of functionality].
 * 
 * Features:
 * - [Key feature 1]
 * - [Key feature 2]
 * - [Key feature 3]
 * 
 * @example
 * ```tsx
 * <ComponentName 
 *   data={userData}
 *   onAction={handleAction}
 *   isLoading={isLoading}
 * />
 * ```
 */
export const ComponentName: React.FC<ComponentNameProps> = ({
  data,
  onAction,
  isLoading = false,
  error = null,
  className,
  children
}) => {
  // State management
  const [localState, setLocalState] = useState<StateType>(initialState);
  
  // Effects with proper cleanup
  useEffect(() => {
    // Effect logic
    
    return () => {
      // Cleanup logic
    };
  }, [dependencies]);
  
  // Event handlers with useCallback for performance
  const handleAction = useCallback(async (params: ActionParams) => {
    try {
      const result = await performAction(params);
      onAction?.(result);
    } catch (error) {
      console.error('Action failed:', error);
      // Handle error appropriately
    }
  }, [onAction]);
  
  // Early returns for loading and error states
  if (isLoading) {
    return <ComponentSkeleton className={className} />;
  }
  
  if (error) {
    return (
      <ErrorFallback 
        error={error}
        onRetry={() => window.location.reload()}
        className={className}
      />
    );
  }
  
  // Main render with proper styling and accessibility
  return (
    <ComponentErrorBoundary componentName="ComponentName">
      <div className={cn('component-base-styles', className)}>
        {/* Component content */}
        {children}
      </div>
    </ComponentErrorBoundary>
  );
};

// Display name for debugging
ComponentName.displayName = 'ComponentName';
```

## Specific Patterns

### 1. Modal Components

```typescript
interface ModalProps {
  /** Modal visibility state */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Optional description */
  description?: string;
  /** Modal size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevent closing on outside click */
  preventClose?: boolean;
  /** Custom styles */
  className?: string;
  /** Modal content */
  children: React.ReactNode;
}

export const StandardModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  preventClose = false,
  className,
  children
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn(modalSizeClasses[size], className)}
        onPointerDownOutside={preventClose ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
```

### 2. Form Components

```typescript
interface FormFieldProps<T> {
  /** Field name for form state */
  name: keyof T;
  /** Field label */
  label: string;
  /** Current value */
  value: T[keyof T];
  /** Change handler */
  onChange: (name: keyof T, value: T[keyof T]) => void;
  /** Validation error */
  error?: string;
  /** Field type */
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea';
  /** Placeholder text */
  placeholder?: string;
  /** Required field indicator */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional props */
  [key: string]: any;
}

export const FormField = <T,>({
  name,
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  ...props
}: FormFieldProps<T>) => {
  const InputComponent = type === 'textarea' ? Textarea : Input;
  
  return (
    <div className="space-y-2">
      <Label htmlFor={String(name)} className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <InputComponent
        id={String(name)}
        type={type === 'textarea' ? undefined : type}
        value={value as string}
        onChange={(e) => onChange(name, e.target.value as T[keyof T])}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full',
          error && 'border-red-500 focus:border-red-500'
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

### 3. Data Display Components

```typescript
interface DataCardProps<T> {
  /** Data to display */
  data: T;
  /** Card title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Render function for data content */
  renderContent: (data: T) => React.ReactNode;
  /** Optional actions */
  actions?: Array<{
    label: string;
    onClick: (data: T) => void;
    variant?: 'default' | 'secondary' | 'destructive';
    disabled?: boolean;
  }>;
  /** Loading state */
  loading?: boolean;
  /** Custom styling */
  className?: string;
}

export const DataCard = <T,>({
  data,
  title,
  subtitle,
  renderContent,
  actions = [],
  loading = false,
  className
}: DataCardProps<T>) => {
  if (loading) {
    return <CardSkeleton className={className} />;
  }

  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {subtitle && (
          <CardDescription>{subtitle}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {renderContent(data)}
        {actions.length > 0 && (
          <div className="flex gap-2 mt-4 pt-4 border-t">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                size="sm"
                onClick={() => action.onClick(data)}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

## Error Handling Patterns

### Component-Level Error Boundaries

```typescript
// Wrap complex components with error boundaries
export const SafeComponent: React.FC<Props> = (props) => (
  <ComponentErrorBoundary componentName="SafeComponent">
    <ComplexComponent {...props} />
  </ComponentErrorBoundary>
);

// Use error boundary HOC for reusable components
export const SafeReusableComponent = withErrorBoundary(
  ReusableComponent,
  CustomErrorFallback
);
```

### Async Operation Error Handling

```typescript
const useAsyncOperation = <T,>(
  operation: () => Promise<T>
) => {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: false,
    error: null
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await operation();
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      setState(prev => ({ ...prev, loading: false, error: errorObj }));
      throw errorObj;
    }
  }, [operation]);

  return { ...state, execute };
};
```

## Performance Patterns

### Memoization Best Practices

```typescript
// Memoize expensive calculations
const ExpensiveComponent: React.FC<Props> = ({ data, options }) => {
  const expensiveValue = useMemo(() => {
    return performExpensiveCalculation(data, options);
  }, [data, options]);

  const memoizedCallback = useCallback((param: string) => {
    return handleAction(param, expensiveValue);
  }, [expensiveValue]);

  return (
    <div>
      {/* Component using memoized values */}
    </div>
  );
};

// Memoize the component itself when appropriate
export const OptimizedComponent = React.memo(
  ExpensiveComponent,
  (prevProps, nextProps) => {
    // Custom comparison logic if needed
    return prevProps.data === nextProps.data && 
           prevProps.options === nextProps.options;
  }
);
```

### Lazy Loading Patterns

```typescript
// Lazy load heavy components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

export const LazyWrapper: React.FC = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <HeavyComponent />
  </Suspense>
);
```

## Testing Patterns

### Component Testing Setup

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComponentName } from './ComponentName';

// Mock setup
const mockOnAction = jest.fn();
const defaultProps = {
  data: mockData,
  onAction: mockOnAction
};

describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<ComponentName {...defaultProps} />);
    
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    render(<ComponentName {...defaultProps} isLoading />);
    
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('handles error state', () => {
    const error = new Error('Test error');
    render(<ComponentName {...defaultProps} error={error} />);
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('calls onAction when button is clicked', async () => {
    render(<ComponentName {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Action Button'));
    
    await waitFor(() => {
      expect(mockOnAction).toHaveBeenCalledWith(expectedResult);
    });
  });
});
```

## Accessibility Patterns

### ARIA and Semantic HTML

```typescript
export const AccessibleComponent: React.FC<Props> = ({ items, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(items[selectedIndex]);
        break;
    }
  };

  return (
    <div
      role="listbox"
      aria-label="Item selection"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => onSelect(item)}
          className={cn(
            'cursor-pointer p-2 rounded',
            index === selectedIndex && 'bg-blue-100'
          )}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
};
```

## Migration Guidelines

### Existing Component Updates

1. **Add TypeScript interfaces** for all props
2. **Implement error boundaries** for complex components
3. **Add loading and error states** where appropriate
4. **Optimize with memoization** for performance-critical components
5. **Add comprehensive tests** for all functionality
6. **Improve accessibility** with proper ARIA attributes

### Code Review Checklist

- [ ] Props interface is properly documented
- [ ] Component has display name
- [ ] Error handling is implemented
- [ ] Loading states are handled
- [ ] Performance optimizations are applied where needed
- [ ] Component is accessible
- [ ] Tests cover all functionality
- [ ] Documentation includes examples

---

**Maintained By:** Frontend Team  
**Review Schedule:** Quarterly  
**Next Review:** October 24, 2025  