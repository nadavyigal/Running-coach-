import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

// Dedicated config for the PAID live eval. Unlike the main vitest config, this
// uses the real node environment and loads NO setup file, so the AI SDK makes
// real network calls instead of hitting the global fetch mock in vitest.setup.ts.
const root = path.resolve(__dirname, '../..');

// Loading no setup file also meant loading no env file, so `npm run eval:plan`
// never saw OPENAI_API_KEY from .env.local and failed exactly the way a missing
// CI secret does. Read it here so the documented local command works as written.
// An explicitly exported key (and the CI secret) always wins over the file.
const fileEnv = loadEnv('development', root, 'OPENAI');
const evalEnv: Record<string, string> = {};
if (!process.env.OPENAI_API_KEY && fileEnv.OPENAI_API_KEY) {
  evalEnv.OPENAI_API_KEY = fileEnv.OPENAI_API_KEY;
}

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['evals/plan-generator/plan-eval.live.test.ts'],
    env: evalEnv,
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
