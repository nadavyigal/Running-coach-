import '@testing-library/jest-dom';

// IndexedDB polyfill for testing
require('fake-indexeddb/auto');

// Mock ResizeObserver for Radix UI and other libraries
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
} 