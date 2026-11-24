import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

// Paid before/after eval for the web chat and run-report prompts. Real node env and no
// setup file, so the AI SDK makes real network calls (same as the plan eval).
const root = path.resolve(__dirname, '../..');
const fileEnv = loadEnv('development', root, 'OPENAI');
const env: Record<string, string> = {};
if (!process.env.OPENAI_API_KEY && fileEnv.OPENAI_API_KEY) env.OPENAI_API_KEY = fileEnv.OPENAI_API_KEY;
// chatDriver uses a 2 s timeout when NODE_ENV is test; use the production 15 s.
env.CHAT_TIMEOUT_MS = process.env.CHAT_TIMEOUT_MS ?? '15000';

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['evals/prompt-upgrade/prompt-upgrade.live.test.ts'],
    env,
    testTimeout: 1_800_000,
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
