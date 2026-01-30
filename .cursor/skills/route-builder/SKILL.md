---
name: route-builder
description: Generates route specifications with distance and elevation constraints. Use when user asks for route suggestions, wants to explore new running paths, or needs safer surface recommendations for upcoming workouts.
metadata:
  short-description: Builds runnable routes with safety constraints and map-ready specs.
  agent: cursor
---

## When Cursor should use this skill
- When the user requests a new route for a target distance/time
- During plan creation if a route is missing for an upcoming workout
- When user wants route exploration or safer surface options
- When implementing route planning features or debugging route generation

## Invocation guidance
1. Provide target distance/time, surfaces, elevation preferences, and start location/constraints.
2. Return route spec with segments, elevation notes, and safety considerations.
3. Ensure output is compatible with `v0/lib/routeHelpers.ts` and `mapConfig.ts`.
4. Include turn-by-turn guidance if possible.
5. Suggest multiple route options (primary + 2 alternatives).

## Input schema
See `references/input-schema.json`.

## Output schema
See `references/output-schema.json`.

## Route components

### Distance constraints
- **Target distance**: Exact distance requested (e.g., 5.0km)
- **Tolerance**: ±5% acceptable (e.g., 4.75-5.25km for 5km route)
- **Segments**: Break into meaningful chunks (e.g., out-and-back, loops)

### Elevation preferences
- **Flat**: <50m total elevation gain
- **Rolling**: 50-150m total elevation gain
- **Hilly**: 150-300m total elevation gain
- **Mountainous**: >300m total elevation gain

### Surface types
- **Paved**: Roads, sidewalks (fastest, most accessible)
- **Trail**: Dirt paths, park trails (softer, scenic)
- **Track**: Synthetic track (flat, measured, boring)
- **Mixed**: Combination of surfaces

### Safety considerations
- **Lighting**: Well-lit for early morning/evening runs
- **Traffic**: Low traffic volume, crosswalks, bike lanes
- **Terrain**: Even surface, minimal tripping hazards
- **Water**: Fountains or facilities available
- **Emergency**: Populated areas, phone signal

## Route patterns

### Out-and-Back
- **Description**: Run out, turn around, return same way
- **Benefits**: Easy navigation, familiar scenery on return
- **Distance**: Any distance, divide by 2 for turnaround point
- **Example**: 5km = 2.5km out, 2.5km back

### Loop
- **Description**: Circular route returning to start
- **Benefits**: New scenery throughout, efficient
- **Distance**: Any distance, map circular path
- **Example**: 10km loop through neighborhood

### Figure-8
- **Description**: Two loops crossing at midpoint (start location)
- **Benefits**: Bathroom/water break at crossing, variety
- **Distance**: Any distance, each loop is half
- **Example**: 8km = two 4km loops

### Point-to-Point
- **Description**: Start at A, finish at B (requires transportation)
- **Benefits**: New scenery, downhill/flat option
- **Distance**: Any distance
- **Example**: 21km half marathon simulation

## Integration points
- **UI**: 
  - Route selector modal
  - Map layer in `v0/lib/mapConfig.ts`
  - Save favorite routes
- **API**: `v0/app/api/route/build` (to add) backed by existing mapping helpers
- **Mapping**: 
  - `v0/lib/routeHelpers.ts` - Route calculations
  - `v0/lib/mapConfig.ts` - Map display
  - Integration with mapping services (Google Maps, Mapbox, etc.)
- **Database**: Store routes in `routes` table (if added)

## Safety & guardrails
- Exclude unsafe surfaces if flagged; avoid steep grades for beginners.
- If location data missing, request clarification and emit `SafetyFlag: missing_data`.
- No medical advice; suggest shorter routes if heat/injury risk.
- Prioritize well-lit, populated areas for safety.
- Warn about traffic-heavy routes.
- Consider time of day (different routes for morning vs evening).

## Route features to include

### Navigation aids
- Turn-by-turn directions
- Landmarks for orientation
- Distance markers along route

### Amenities
- Water fountains
- Bathrooms/facilities
- Parking areas
- Public transportation access

### Points of interest
- Scenic views
- Parks and green spaces
- Historic landmarks
- Photo-worthy spots

### Warnings
- High traffic areas
- Steep hills/stairs
- Construction zones
- Poorly lit sections

## Experience-level adaptations

### Beginner
- Shorter routes (<5km)
- Flat terrain preferred
- Well-populated areas
- Multiple bail-out options
- Near facilities

### Intermediate
- Medium routes (5-15km)
- Some hills acceptable
- Variety in scenery/surface
- Longer segments between facilities

### Advanced
- Long routes (15km+)
- Challenging terrain okay
- Less frequent amenities
- More remote areas acceptable

## Telemetry
- Emit `ai_skill_invoked` with:
  - `distance`
  - `surface`
  - `elevation_gain`
  - `safety_flags`
  - `route_type` (out-and-back/loop/etc)
  - `alternatives_provided` (count)

## Common edge cases
- **Unknown location**: Request start address or use GPS if available
- **No suitable routes**: Suggest nearest alternatives, track option, or treadmill
- **Extreme distance**: Break into segments or suggest multiple days
- **Weather constraints**: Indoor or covered route suggestions
- **Safety concerns**: Prioritize populated, well-lit alternatives
- **Limited space**: Figure-8 or multiple small loops

## Alternative suggestions

When providing route alternatives, vary by:
1. **Surface type**: If primary is paved, offer trail option
2. **Elevation**: If primary is flat, offer hilly option
3. **Scenery**: Different neighborhood or park
4. **Pattern**: If primary is out-and-back, offer loop option

## Testing considerations
- Test with various distance targets (1km to 42km)
- Verify elevation calculation accuracy
- Test surface type filtering
- Validate safety considerations
- Test with missing location data
- Verify map integration compatibility
- Test alternative route variety
