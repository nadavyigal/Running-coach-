import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Server-route contract tests do not need the browser/IndexedDB setup.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'app/api/devices/garmin/callback/route.test.ts',
      'app/api/devices/garmin/webhook/**/*.test.ts',
    ],
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      'server-only': path.resolve(__dirname, 'lib/__mocks__/server-only.ts'),
    },
  },
})
