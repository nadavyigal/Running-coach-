/**
 * Clear Demo Routes Utility
 * Removes hardcoded Tel Aviv demo routes from the database
 */

import { db } from './db';

/**
 * Tel Aviv bounding box coordinates
 * Used to identify demo routes that were hardcoded for Tel Aviv
 */
const TEL_AVIV_BOUNDS = {
  minLat: 32.0,
  maxLat: 32.2,
  minLng: 34.7,
  maxLng: 34.9,
};

/**
 * Check if a route is within Tel Aviv bounds (likely a demo route)
 */
function isTelAvivDemoRoute(startLat?: number, startLng?: number): boolean {
  if (!startLat || !startLng) return false;

  return (
    startLat >= TEL_AVIV_BOUNDS.minLat &&
    startLat <= TEL_AVIV_BOUNDS.maxLat &&
    startLng >= TEL_AVIV_BOUNDS.minLng &&
    startLng <= TEL_AVIV_BOUNDS.maxLng
  );
}

/**
 * Check if user's location is NOT in Tel Aviv
 * Returns true if we should clear Tel Aviv demo routes
 */
export async function shouldClearTelAvivRoutes(
  userLat?: number,
  userLng?: number
): Promise<boolean> {
  // If no user location provided, assume we should clear
  if (!userLat || !userLng) {
    return true;
  }

  // If user is far from Tel Aviv (>50km), clear the demo routes
  const distanceFromTelAviv = calculateDistance(
    userLat,
    userLng,
    32.0853, // Tel Aviv center
    34.7818
  );

  return distanceFromTelAviv > 50; // More than 50km away
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Clear all Tel Aviv demo routes from the database
 * This removes the hardcoded demo routes that aren't relevant to users outside Tel Aviv
 */
export async function clearTelAvivDemoRoutes(): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    const allRoutes = await db.routes.toArray();
    const demoRoutes = allRoutes.filter(
      (route) =>
        route.createdBy === 'system' &&
        isTelAvivDemoRoute(route.startLat, route.startLng)
    );

    if (demoRoutes.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // Delete all Tel Aviv demo routes
    const routeIds = demoRoutes.map((r) => r.id).filter((id): id is number => id !== undefined);
    await db.routes.bulkDelete(routeIds);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🗑️ Cleared ${demoRoutes.length} Tel Aviv demo routes`);
    }

    return { success: true, deletedCount: demoRoutes.length };
  } catch (error) {
    console.error('Error clearing Tel Aviv demo routes:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear ALL system-generated routes (for complete reset)
 */
export async function clearAllDemoRoutes(): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    const allRoutes = await db.routes.toArray();
    const demoRoutes = allRoutes.filter((route) => route.createdBy === 'system');

    if (demoRoutes.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const routeIds = demoRoutes.map((r) => r.id).filter((id): id is number => id !== undefined);
    await db.routes.bulkDelete(routeIds);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🗑️ Cleared ${demoRoutes.length} demo routes`);
    }

    return { success: true, deletedCount: demoRoutes.length };
  } catch (error) {
    console.error('Error clearing demo routes:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
