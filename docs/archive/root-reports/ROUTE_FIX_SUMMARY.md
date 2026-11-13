# Route Location Fix - Summary

## Problem
The running coach application was showing hardcoded Tel Aviv, Israel routes to all users regardless of their actual location. This was because:
1. Demo routes with Tel Aviv GPS coordinates were seeded into IndexedDB
2. These routes persisted across deployments
3. Users on mobile devices saw "Random Part Loop", "Downtown Circuit", etc. instead of relevant local routes

## Solution Implemented

### 1. Created Utility to Clear Tel Aviv Routes
**File:** `v0/lib/clearDemoRoutes.ts`
- `clearTelAvivDemoRoutes()` - Removes hardcoded Tel Aviv routes
- `clearAllDemoRoutes()` - Removes all system-generated demo routes
- `shouldClearTelAvivRoutes()` - Checks if user is >50km from Tel Aviv

### 2. Updated Route Seeding Logic
**File:** `v0/lib/seedRoutes.ts`
- Added location check parameter to `seedDemoRoutes()`
- Added `calculateDistanceFromTelAviv()` helper function
- Routes only seed if user is within 50km of Tel Aviv (for Tel Aviv users only)
- Added documentation warning that these are hardcoded demo routes

### 3. Updated Route Components
**Files:**
- `v0/components/route-selection-wizard.tsx`
- `v0/components/route-selector-modal.tsx`

Changes:
- Automatically detect user location via GPS
- Clear Tel Aviv routes if user is not in Tel Aviv area
- No longer auto-seed demo routes (users create custom routes instead)
- Handle empty route lists gracefully

### 4. Created One-Time Migration
**File:** `v0/lib/migrations/clearTelAvivRoutesMigration.ts`
- Runs once per browser/device (tracked in localStorage)
- Automatically clears Tel Aviv demo routes on app startup
- Non-blocking migration (won't crash app if it fails)

### 5. Integrated Migration into Startup
**File:** `v0/lib/dbUtils.ts`
- Added route migration to `performStartupMigration()`
- Migration runs automatically when app loads
- Logs migration results for debugging

### 6. Removed Auto-Seeding
**File:** `v0/app/page.tsx`
- Removed automatic call to `seedDemoRoutes()` on app init
- Routes are no longer auto-populated with Tel Aviv data

## How It Works

### On App Startup:
1. App initializes database
2. Migration runs and checks localStorage for `migration_clear_tel_aviv_routes_v1`
3. If migration hasn't run before:
   - Clears all system-generated demo routes from database
   - Marks migration as complete in localStorage
4. Migration only runs once per browser/device

### When User Opens Route Selection:
1. Component requests user's GPS location
2. If user location obtained:
   - Checks if user is >50km from Tel Aviv
   - If yes, clears any remaining Tel Aviv demo routes
3. Loads remaining routes (custom user routes)
4. If no routes exist, shows empty state with option to create custom route

## User Experience

### For Users Outside Tel Aviv:
- Tel Aviv demo routes are automatically removed
- Empty route list on first use
- Prompted to create custom routes using map interface
- Custom routes are saved and persist

### For Users in Tel Aviv:
- May still see Tel Aviv demo routes (they're relevant)
- Can still create custom routes
- Routes are location-appropriate

## Testing Instructions

### On Desktop (Development):
```bash
cd v0
npm run build
npm run dev
```

1. Open browser console
2. Look for migration logs: `[migration:routes] Cleared X Tel Aviv demo routes`
3. Open Route Selection Wizard
4. Verify no Tel Aviv routes appear (unless you're in Tel Aviv)
5. Create a custom route to test functionality

### On Mobile (Production):
1. Deploy the updated code
2. Open app on mobile device
3. Grant location permission when prompted
4. Open route selection
5. Verify:
   - Tel Aviv routes are gone
   - Can create custom routes
   - Custom routes appear in list

### To Force Re-run Migration (Testing):
```javascript
// In browser console:
localStorage.removeItem('migration_clear_tel_aviv_routes_v1');
location.reload();
```

## Files Modified

1. `v0/lib/clearDemoRoutes.ts` (NEW)
2. `v0/lib/migrations/clearTelAvivRoutesMigration.ts` (NEW)
3. `v0/lib/seedRoutes.ts` (MODIFIED)
4. `v0/lib/dbUtils.ts` (MODIFIED)
5. `v0/components/route-selection-wizard.tsx` (MODIFIED)
6. `v0/components/route-selector-modal.tsx` (MODIFIED)
7. `v0/app/page.tsx` (MODIFIED)

## Future Enhancements

1. **Location-Based Route API Integration**
   - Integrate with OpenStreetMap Overpass API
   - Fetch real running routes based on user location
   - Cache routes locally for offline use

2. **Community Routes**
   - Allow users to share routes
   - Filter routes by location
   - Rate and review routes

3. **Route Discovery**
   - Generate routes automatically based on distance preference
   - Use road/path networks from mapping APIs
   - Suggest popular running areas nearby

## Rollback Plan

If issues occur, you can:
1. Revert the commits
2. Or manually reseed Tel Aviv routes with: `seedDemoRoutes(false)` in console

## Migration Safety

- Migration is one-time per device
- Non-blocking (won't crash app if fails)
- Preserves user-created custom routes
- Only removes system-generated Tel Aviv routes
- Can be forced to re-run for testing
