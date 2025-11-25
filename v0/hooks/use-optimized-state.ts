/**
 * Optimized state management hooks for performance
 * Provides memoized callbacks and optimized state updates
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import type { DependencyList } from 'react';

/**
 * Stable callback hook - prevents unnecessary re-renders
 * Similar to useCallback but with guaranteed referential stability
 *
 * @param callback - The callback function to stabilize
 * @returns Stable callback reference
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: any[]) => callbackRef.current(...args), []) as T;
}

/**
 * Debounced callback hook - delays execution until after a specified time
 * Useful for search inputs, resize handlers, etc.
 *
 * @param callback - The callback to debounce
 * @param delay - Delay in milliseconds
 * @param deps - Dependency array
 * @returns Debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...deps]
  ) as T;
}

/**
 * Throttled callback hook - limits execution frequency
 * Executes at most once per specified interval
 *
 * @param callback - The callback to throttle
 * @param delay - Minimum interval in milliseconds
 * @param deps - Dependency array
 * @returns Throttled callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: DependencyList = []
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        callback(...args);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...deps]
  ) as T;
}

/**
 * Memoized value with custom equality check
 * More flexible than useMemo with deep equality support
 *
 * @param factory - Function that produces the value
 * @param deps - Dependency array
 * @param isEqual - Custom equality function (optional)
 * @returns Memoized value
 */
export function useMemoizedValue<T>(
  factory: () => T,
  deps: DependencyList,
  isEqual?: (a: T, b: T) => boolean
): T {
  const valueRef = useRef<T>();
  const depsRef = useRef<DependencyList>(deps);

  const shouldUpdate = useMemo(() => {
    if (!valueRef.current) return true;

    if (depsRef.current.length !== deps.length) return true;

    for (let i = 0; i < deps.length; i++) {
      if (depsRef.current[i] !== deps[i]) return true;
    }

    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  if (shouldUpdate) {
    const newValue = factory();

    if (!valueRef.current || !isEqual || !isEqual(valueRef.current, newValue)) {
      valueRef.current = newValue;
      depsRef.current = deps;
    }
  }

  return valueRef.current as T;
}

/**
 * Previous value hook - returns the previous value of a prop or state
 * Useful for tracking changes and transitions
 *
 * @param value - Current value
 * @returns Previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Mount status hook - tracks if component is mounted
 * Useful for preventing state updates on unmounted components
 *
 * @returns Boolean indicating if component is mounted
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

/**
 * Async callback hook - safely handles async operations
 * Prevents state updates if component unmounts during async operation
 *
 * @param asyncCallback - The async callback
 * @param deps - Dependency array
 * @returns Safe async callback
 */
export function useSafeAsyncCallback<T extends (...args: any[]) => Promise<any>>(
  asyncCallback: T,
  deps: DependencyList = []
): T {
  const isMounted = useIsMounted();

  return useCallback(
    async (...args: Parameters<T>) => {
      const result = await asyncCallback(...args);

      if (isMounted()) {
        return result;
      }

      return undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMounted, ...deps]
  ) as T;
}

/**
 * Lazy initialization hook - defers expensive computation until needed
 * More performant than useMemo for one-time initialization
 *
 * @param initializer - Function that creates the initial value
 * @returns Initialized value
 */
export function useLazyInit<T>(initializer: () => T): T {
  const ref = useRef<T>();

  if (ref.current === undefined) {
    ref.current = initializer();
  }

  return ref.current;
}

/**
 * Optimized array hook - memoizes array operations
 * Prevents unnecessary re-renders when array content hasn't changed
 *
 * @param array - Input array
 * @param comparator - Optional custom comparator
 * @returns Memoized array
 */
export function useOptimizedArray<T>(
  array: T[],
  comparator?: (a: T[], b: T[]) => boolean
): T[] {
  const previousArray = useRef<T[]>(array);

  const hasChanged = useMemo(() => {
    if (comparator) {
      return !comparator(previousArray.current, array);
    }

    if (previousArray.current.length !== array.length) {
      return true;
    }

    for (let i = 0; i < array.length; i++) {
      if (previousArray.current[i] !== array[i]) {
        return true;
      }
    }

    return false;
  }, [array, comparator]);

  if (hasChanged) {
    previousArray.current = array;
  }

  return previousArray.current;
}

/**
 * Update effect hook - runs effect only when value changes (not on mount)
 * Useful for responding to prop/state changes without running on initial render
 *
 * @param effect - Effect function
 * @param deps - Dependencies
 */
export function useUpdateEffect(
  effect: React.EffectCallback,
  deps: DependencyList
): void {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
