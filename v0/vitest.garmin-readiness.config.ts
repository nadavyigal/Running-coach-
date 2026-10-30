import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Server-route contract tests do not need the browser/IndexedDB setup.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'lib/garmin/access-policy.test.ts',
      'lib/integrations/garmin/client-access.test.ts',
      'lib/server/garmin-endpoints.test.ts',
      'lib/server/garmin-oauth-store.test.ts',
      'app/api/devices/garmin/disconnect/route.test.ts',
      'app/api/devices/garmin/backfill/route.test.ts',
      'app/api/devices/garmin/activities/route.test.ts',
      'app/api/devices/garmin/sleep/route.test.ts',
      'app/api/devices/garmin/status/route.test.ts',
      'app/api/devices/garmin/sync/route.test.ts',
      'lib/integrations/garmin/service.test.ts',
      'lib/integrations/garmin/permission-changes.test.ts',
      'lib/server/garmin-export-store.test.ts',
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
