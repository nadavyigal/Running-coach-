import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Dedicated config for the PAID live eval. Unlike the main vitest config, this
// uses the real node environment and loads NO setup file, so the AI SDK makes
// real network calls instead of hitting the global fetch mock in vitest.setup.ts.
const root = path.resolve(__dirname, '../..');

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['evals/plan-generator/plan-eval.live.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': root,
      '@/lib': path.resolve(root, 'lib'),
      '@/components': path.resolve(root, 'components'),
      '@/components/ui': path.resolve(root, 'components/ui'),
    },
  },
});
