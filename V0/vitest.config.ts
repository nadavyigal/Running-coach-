import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/e2e/**',
      '**/*.spec.ts',
      '**/*.spec.tsx'
    ],
    // Coverage configuration (requires @vitest/coverage-v8)
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    //   exclude: ['node_modules/', '**/*.config.*', '**/test-utils/**']
    // },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    maxConcurrency: 1,
    testTimeout: 5000,
    hookTimeout: 3000,
    teardownTimeout: 3000,
    silent: false,
    reporters: ['default'],
    logHeapUsage: true,
    isolate: false,
    passWithNoTests: true,
    memoryLimit: '512MB'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/components': path.resolve(__dirname, 'components'),
      '@/components/ui': path.resolve(__dirname, 'components/ui'),
    },
  },
}); 