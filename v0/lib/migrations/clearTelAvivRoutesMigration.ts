/**
 * One-time migration to clear Tel Aviv demo routes
 * This migration will run once per user to clean up hardcoded Tel Aviv routes
 */

import { clearAllDemoRoutes } from '../clearDemoRoutes';

const MIGRATION_KEY = 'migration_clear_tel_aviv_routes_v1';

/**
 * Check if migration has already been run
 */
function hasMigrationRun(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MIGRATION_KEY) === 'completed';
}

/**
 * Mark migration as complete
 */
function markMigrationComplete(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MIGRATION_KEY, 'completed');
  localStorage.setItem(`${MIGRATION_KEY}_timestamp`, new Date().toISOString());
}

/**
 * Run the migration to clear Tel Aviv demo routes
 * This will only run once per browser/device
 */
export async function runClearTelAvivRoutesMigration(): Promise<{
  migrationRun: boolean;
  routesCleared: number;
  message: string;
}> {
  // Check if migration already completed
  if (hasMigrationRun()) {
    return {
      migrationRun: false,
      routesCleared: 0,
      message: 'Migration already completed',
    };
  }

  try {
    console.log('🔄 Running migration: Clear Tel Aviv demo routes...');

    // Clear all system-generated demo routes
    const result = await clearAllDemoRoutes();

    if (result.success) {
      // Mark migration as complete
      markMigrationComplete();

      console.log(`✅ Migration complete: Cleared ${result.deletedCount} demo routes`);

      return {
        migrationRun: true,
        routesCleared: result.deletedCount,
        message: `Successfully cleared ${result.deletedCount} demo routes`,
      };
    } else {
      console.error('❌ Migration failed:', result.error);
      return {
        migrationRun: false,
        routesCleared: 0,
        message: `Migration failed: ${result.error}`,
      };
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    return {
      migrationRun: false,
      routesCleared: 0,
      message: `Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Force re-run the migration (for testing purposes)
 */
export function resetMigration(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MIGRATION_KEY);
  localStorage.removeItem(`${MIGRATION_KEY}_timestamp`);
  console.log('🔄 Migration reset - will run on next app load');
}
