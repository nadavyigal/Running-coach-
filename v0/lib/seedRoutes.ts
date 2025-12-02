/**
 * Seed Demo Routes
 * Creates demo routes with realistic GPS paths for Tel Aviv area
 */

import { db, type Route } from './db';
import type { LatLng } from './mapConfig';
import { stringifyGpsPath } from './routeUtils';

/**
 * Generate realistic GPS path for a route
 */
function generateRoutePath(
  start: LatLng,
  end: LatLng,
  numPoints: number = 15,
  variation: number = 0.001
): LatLng[] {
  const points: LatLng[] = [start];

  for (let i = 1; i < numPoints - 1; i++) {
    const fraction = i / (numPoints - 1);
    const baseLat = start.lat + (end.lat - start.lat) * fraction;
    const baseLng = start.lng + (end.lng - start.lng) * fraction;

    // Add slight random variation to make path more realistic
    const varLat = (Math.random() - 0.5) * variation;
    const varLng = (Math.random() - 0.5) * variation;

    points.push({
      lat: baseLat + varLat,
      lng: baseLng + varLng,
    });
  }

  points.push(end);
  return points;
}

/**
 * Calculate distance from Tel Aviv center (Haversine formula)
 * @returns distance in kilometers
 */
function calculateDistanceFromTelAviv(lat: number, lng: number): number {
  const TEL_AVIV_CENTER_LAT = 32.0853;
  const TEL_AVIV_CENTER_LNG = 34.7818;

  const R = 6371; // Earth's radius in km
  const dLat = ((lat - TEL_AVIV_CENTER_LAT) * Math.PI) / 180;
  const dLng = ((lng - TEL_AVIV_CENTER_LNG) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((TEL_AVIV_CENTER_LAT * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Seed database with demo routes
 * Creates 10 varied routes in Tel Aviv area with complete GPS paths
 *
 * NOTE: This function seeds HARDCODED Tel Aviv routes and should only be used
 * for development/testing purposes. In production, users should create custom routes
 * or routes should be fetched based on user's actual location.
 *
 * @param forceLocationCheck - If true, will check if user is in Tel Aviv before seeding
 * @param userLocation - Optional user location to check if seeding is appropriate
 * @returns true if seeding was successful, false otherwise
 */
export async function seedDemoRoutes(
  forceLocationCheck: boolean = false,
  userLocation?: { latitude: number; longitude: number }
): Promise<boolean> {
  try {
    // Check if routes already exist
    const existingRoutes = await db.routes.count();
    if (existingRoutes > 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Routes already seeded, skipping...');
      }
      return true;
    }

    // If location check is forced, only seed if user is in Tel Aviv area
    if (forceLocationCheck && userLocation) {
      const distanceFromTelAviv = calculateDistanceFromTelAviv(
        userLocation.latitude,
        userLocation.longitude
      );

      if (distanceFromTelAviv > 50) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('⚠️ User not in Tel Aviv area, skipping demo route seeding');
          console.log('   Users should create custom routes or use location-based route discovery');
        }
        return false;
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('🌱 Seeding Tel Aviv demo routes...');
    }

    const demoRoutes: Omit<Route, 'id'>[] = [
      // 1. Beach Promenade Run
      {
        name: 'Tel Aviv Beach Promenade',
        distance: 5.2,
        difficulty: 'beginner',
        safetyScore: 95,
        popularity: 90,
        elevationGain: 10,
        surfaceType: ['paved'],
        wellLit: true,
        lowTraffic: true,
        scenicScore: 95,
        estimatedTime: 30,
        description: 'Scenic beachfront route along the Mediterranean coastline',
        tags: ['beach', 'flat', 'scenic', 'popular'],
        startLat: 32.0748,
        startLng: 34.7678,
        endLat: 32.1050,
        endLng: 34.7750,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0748, lng: 34.7678 },
            { lat: 32.1050, lng: 34.7750 },
            20,
            0.0005
          )
        ),
        location: 'Tel Aviv Beach',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 2. Yarkon Park Loop
      {
        name: 'Yarkon Park Trail',
        distance: 7.5,
        difficulty: 'intermediate',
        safetyScore: 85,
        popularity: 80,
        elevationGain: 25,
        surfaceType: ['trail', 'paved'],
        wellLit: true,
        lowTraffic: true,
        scenicScore: 88,
        estimatedTime: 45,
        description: 'Popular park loop with river views and varied terrain',
        tags: ['park', 'nature', 'river', 'moderate'],
        startLat: 32.0970,
        startLng: 34.7852,
        endLat: 32.0970,
        endLng: 34.7852,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0970, lng: 34.7852 },
            { lat: 32.1020, lng: 34.8050 },
            25,
            0.0008
          ).concat(
            generateRoutePath(
              { lat: 32.1020, lng: 34.8050 },
              { lat: 32.0970, lng: 34.7852 },
              15,
              0.0008
            )
          )
        ),
        location: 'Yarkon Park',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 3. Rothschild Boulevard
      {
        name: 'Rothschild Boulevard Classic',
        distance: 3.8,
        difficulty: 'beginner',
        safetyScore: 90,
        popularity: 85,
        elevationGain: 15,
        surfaceType: ['paved'],
        wellLit: true,
        lowTraffic: false,
        scenicScore: 75,
        estimatedTime: 23,
        description: 'Historic boulevard route through the heart of Tel Aviv',
        tags: ['urban', 'historic', 'architecture', 'easy'],
        startLat: 32.0593,
        startLng: 34.7728,
        endLat: 32.0730,
        endLng: 34.7810,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0593, lng: 34.7728 },
            { lat: 32.0730, lng: 34.7810 },
            15,
            0.0003
          )
        ),
        location: 'Rothschild Boulevard',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 4. Jaffa Port Circuit
      {
        name: 'Old Jaffa Coastal Route',
        distance: 4.5,
        difficulty: 'beginner',
        safetyScore: 88,
        popularity: 75,
        elevationGain: 30,
        surfaceType: ['paved', 'cobblestone'],
        wellLit: true,
        lowTraffic: true,
        scenicScore: 92,
        estimatedTime: 28,
        description: 'Historical route through old Jaffa with Mediterranean views',
        tags: ['historic', 'coastal', 'scenic', 'cultural'],
        startLat: 32.0530,
        startLng: 34.7520,
        endLat: 32.0530,
        endLng: 34.7520,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0530, lng: 34.7520 },
            { lat: 32.0580, lng: 34.7550 },
            12,
            0.0004
          ).concat(
            generateRoutePath(
              { lat: 32.0580, lng: 34.7550 },
              { lat: 32.0530, lng: 34.7520 },
              12,
              0.0004
            )
          )
        ),
        location: 'Jaffa',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 5. Neve Tzedek Explorer
      {
        name: 'Neve Tzedek Neighborhood Loop',
        distance: 2.8,
        difficulty: 'beginner',
        safetyScore: 92,
        popularity: 70,
        elevationGain: 8,
        surfaceType: ['paved'],
        wellLit: true,
        lowTraffic: true,
        scenicScore: 85,
        estimatedTime: 18,
        description: 'Charming neighborhood route through historic streets',
        tags: ['neighborhood', 'historic', 'quiet', 'short'],
        startLat: 32.0580,
        startLng: 34.7640,
        endLat: 32.0580,
        endLng: 34.7640,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0580, lng: 34.7640 },
            { lat: 32.0620, lng: 34.7680 },
            10,
            0.0003
          ).concat(
            generateRoutePath(
              { lat: 32.0620, lng: 34.7680 },
              { lat: 32.0580, lng: 34.7640 },
              10,
              0.0003
            )
          )
        ),
        location: 'Neve Tzedek',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 6. North Tel Aviv Challenge
      {
        name: 'North Tel Aviv Long Run',
        distance: 12.0,
        difficulty: 'advanced',
        safetyScore: 82,
        popularity: 65,
        elevationGain: 50,
        surfaceType: ['paved', 'trail'],
        wellLit: true,
        lowTraffic: true,
        scenicScore: 80,
        estimatedTime: 72,
        description: 'Challenging long-distance route through northern neighborhoods',
        tags: ['long', 'challenging', 'varied', 'endurance'],
        startLat: 32.0853,
        startLng: 34.7818,
        endLat: 32.1350,
        endLng: 34.8050,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0853, lng: 34.7818 },
            { lat: 32.1350, lng: 34.8050 },
            35,
            0.001
          )
        ),
        location: 'North Tel Aviv',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 7. Sarona Park Quick Run
      {
        name: 'Sarona Park Circuit',
        distance: 1.5,
        difficulty: 'beginner',
        safetyScore: 95,
        popularity: 60,
        elevationGain: 5,
        surfaceType: ['paved'],
        wellLit: true,
        lowTraffic: true,
        scenicScore: 70,
        estimatedTime: 10,
        description: 'Short urban park loop, perfect for quick workouts',
        tags: ['short', 'urban', 'park', 'quick'],
        startLat: 32.0740,
        startLng: 34.7870,
        endLat: 32.0740,
        endLng: 34.7870,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0740, lng: 34.7870 },
            { lat: 32.0760, lng: 34.7890 },
            8,
            0.0002
          ).concat(
            generateRoutePath(
              { lat: 32.0760, lng: 34.7890 },
              { lat: 32.0740, lng: 34.7870 },
              7,
              0.0002
            )
          )
        ),
        location: 'Sarona',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 8. Florentine Street Art Run
      {
        name: 'Florentine Neighborhood Tour',
        distance: 4.2,
        difficulty: 'intermediate',
        safetyScore: 80,
        popularity: 72,
        elevationGain: 20,
        surfaceType: ['paved'],
        wellLit: true,
        lowTraffic: false,
        scenicScore: 78,
        estimatedTime: 26,
        description: 'Urban route through the vibrant Florentine district',
        tags: ['urban', 'art', 'culture', 'neighborhood'],
        startLat: 32.0520,
        startLng: 34.7650,
        endLat: 32.0520,
        endLng: 34.7650,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0520, lng: 34.7650 },
            { lat: 32.0580, lng: 34.7700 },
            14,
            0.0004
          ).concat(
            generateRoutePath(
              { lat: 32.0580, lng: 34.7700 },
              { lat: 32.0520, lng: 34.7650 },
              14,
              0.0004
            )
          )
        ),
        location: 'Florentine',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 9. Tel Aviv Port Loop
      {
        name: 'Tel Aviv Port Marina',
        distance: 6.0,
        difficulty: 'intermediate',
        safetyScore: 87,
        popularity: 78,
        elevationGain: 15,
        surfaceType: ['paved'],
        wellLit: true,
        lowTraffic: true,
        scenicScore: 86,
        estimatedTime: 36,
        description: 'Waterfront route around the renovated port area',
        tags: ['waterfront', 'port', 'scenic', 'modern'],
        startLat: 32.1050,
        startLng: 34.7750,
        endLat: 32.1050,
        endLng: 34.7750,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.1050, lng: 34.7750 },
            { lat: 32.1120, lng: 34.7800 },
            18,
            0.0005
          ).concat(
            generateRoutePath(
              { lat: 32.1120, lng: 34.7800 },
              { lat: 32.1050, lng: 34.7750 },
              18,
              0.0005
            )
          )
        ),
        location: 'Tel Aviv Port',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // 10. City Center Mixed Terrain
      {
        name: 'City Center Cross-Training',
        distance: 8.5,
        difficulty: 'advanced',
        safetyScore: 78,
        popularity: 68,
        elevationGain: 40,
        surfaceType: ['paved', 'trail', 'mixed'],
        wellLit: true,
        lowTraffic: false,
        scenicScore: 72,
        estimatedTime: 52,
        description: 'Varied terrain route through central Tel Aviv neighborhoods',
        tags: ['mixed', 'challenging', 'urban', 'varied'],
        startLat: 32.0800,
        startLng: 34.7800,
        endLat: 32.0800,
        endLng: 34.7800,
        gpsPath: stringifyGpsPath(
          generateRoutePath(
            { lat: 32.0800, lng: 34.7800 },
            { lat: 32.0950, lng: 34.7950 },
            28,
            0.0008
          ).concat(
            generateRoutePath(
              { lat: 32.0950, lng: 34.7950 },
              { lat: 32.0800, lng: 34.7800 },
              22,
              0.0008
            )
          )
        ),
        location: 'City Center',
        routeType: 'predefined',
        createdBy: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert all routes
    await db.routes.bulkAdd(demoRoutes);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Successfully seeded ${demoRoutes.length} demo routes`);
    }
    return true;
  } catch (error) {
    console.error('❌ Error seeding demo routes:', error);
    // Don't throw - return false to indicate failure
    return false;
  }
}
