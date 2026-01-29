---
name: race-strategy-builder
description: Generates race-day pacing and fueling strategies with contingency plans. Use when user has an upcoming race, asks for race preparation advice, or wants a printable race-day plan with segment pacing and fueling schedule.
metadata:
  short-description: Race-day pacing, fueling, and contingency plan generator.
  agent: cursor
---

## When Cursor should use this skill
- When the user sets up a race event or asks for race pacing guidance
- Prior to race week to deliver printable/shareable strategy
- When user requests race preparation or race-day tactics
- When implementing race planning features or debugging race strategies

## Invocation guidance
1. Provide `UserProfile`, `TrainingHistory`, target race distance/date, course notes (elevation, weather).
2. Produce pacing plan by segment, fueling schedule, and contingencies (heat, hills).
3. Keep recommendations conservative if recent load is low or injury flags exist.
4. Base pace targets on recent workout performance and goal time.
5. Include pre-race, during-race, and post-race guidance.

## Input schema
See `references/input-schema.json`.

## Output schema
See `references/output-schema.json`.

## Pacing strategies

### Even Pacing (recommended for most)
- **Description**: Consistent pace throughout race
- **Best for**: First-time distance, hot weather, hilly courses
- **Target**: Goal pace ±5 seconds/km
- **Example**: Marathon at 5:30/km → all segments at 5:25-5:35/km

### Negative Split
- **Description**: Second half faster than first
- **Best for**: Experienced runners, flat courses, good conditions
- **Target**: First half 3-5% slower, second half 3-5% faster
- **Example**: Half marathon goal 1:45 → first half 53min, second half 52min

### Positive Split (survival mode)
- **Description**: Start faster, slow down later (not ideal but realistic)
- **Best for**: Hot weather, challenging course, conservative approach
- **Target**: First half at goal pace, manage slowdown in second half
- **Example**: 10K goal 50min → first 5K at 4:50/km, second 5K at 5:10/km

## Fueling strategy

### Short races (5K-10K)
- **Pre-race**: Normal breakfast 2-3 hours before, hydrate well
- **During**: Water at aid stations if available, no fuel needed
- **Post-race**: Recovery snack within 30 minutes

### Medium races (Half Marathon)
- **Pre-race**: Carb-rich breakfast 2-3 hours before
- **During**: 
  - Water every 3-5km
  - Optional gel at 10km if >90 minutes
  - Sip, don't gulp
- **Post-race**: Protein + carbs within 30 minutes

### Long races (Marathon)
- **Pre-race**: Carb-rich breakfast 3-4 hours before, hydrate well
- **During**:
  - Water every 5km
  - Gel/chews every 45 minutes (start at 30-45 min mark)
  - Electrolytes if hot or >90 minutes
  - Practice fueling strategy in training!
- **Post-race**: Recovery meal, continue hydrating

## Race segments structure

### 5K Race Segments
- **Segment 1** (0-1km): Controlled start, find rhythm
- **Segment 2** (1-4km): Settle into goal pace
- **Segment 3** (4-5km): Push to finish

### 10K Race Segments
- **Segment 1** (0-2km): Controlled start
- **Segment 2** (2-8km): Maintain goal pace
- **Segment 3** (8-10km): Final push

### Half Marathon Segments
- **Segment 1** (0-5km): Controlled start, avoid going out too fast
- **Segment 2** (5-15km): Settle into target pace
- **Segment 3** (15-21km): Dig deep, maintain form

### Marathon Segments
- **Segment 1** (0-10km): Very controlled start, feels easy
- **Segment 2** (10-21km): Find rhythm, stay relaxed
- **Segment 3** (21-30km): Mental game begins, maintain pace
- **Segment 4** (30-42km): Dig deep, survival mode if needed

## Integration points
- **UI**: 
  - Race setup flow
  - Shareable race card (printable)
  - Pre-race checklist
- **API**: `v0/app/api/race/strategy` (to add)
- **Export**: Generate text for notes and chat share via `v0/lib/enhanced-ai-coach.ts`
- **Database**: Store race plans in `race_strategies` table (if added)

## Safety & guardrails
- No medical advice; if user reports pain/injury, advise deferring race or adjusting pace drastically.
- Clamp pacing to safe ranges based on recent easy pace; avoid aggressive negative splits for beginners.
- Emit `SafetyFlag` when hydration/fueling cannot be recommended due to missing data.
- Never recommend untested fueling strategies - emphasize "nothing new on race day."
- If recent training volume is low, recommend conservative pacing or race deferral.

## Contingency plans

### Hot weather (>25°C / 77°F)
- Slow all paces by 10-20 seconds/km
- Double hydration frequency
- Start extra conservatively
- Consider DNS (Did Not Start) if extreme heat

### Hilly course
- Adjust pacing for elevation:
  - Uphill: 10-30 seconds/km slower (effort-based)
  - Downhill: 5-15 seconds/km faster (controlled)
- Focus on effort, not pace
- Save energy for later climbs

### Bad weather (rain/wind/cold)
- Adjust clothing and gear
- Modify pace expectations by 5-10%
- Increase warm-up time
- Be flexible with goals

### Mid-race struggles
- **If ahead of pace**: Don't panic, bank time is okay
- **If behind pace**: Reassess goal, don't push into injury
- **If feeling bad**: Walk breaks are okay, finish is the goal
- **If in pain**: DNF (Did Not Finish) is wise if injury risk

## Pre-race checklist

### Week before
- ✓ Taper volume (reduce by 40-60%)
- ✓ Maintain intensity (short efforts to stay sharp)
- ✓ Extra sleep
- ✓ Hydrate well
- ✓ Review race course and strategy

### Day before
- ✓ Light shakeout run (15-20 minutes easy)
- ✓ Carb-load dinner (not excessive)
- ✓ Prepare race kit (nothing new!)
- ✓ Check weather forecast
- ✓ Early bedtime

### Race morning
- ✓ Wake 3-4 hours before start
- ✓ Familiar breakfast
- ✓ Hydrate (stop 1 hour before)
- ✓ Arrive early (parking, bag check, bathroom)
- ✓ Dynamic warm-up (10-15 minutes)

## Telemetry
- Emit `ai_skill_invoked` and `ai_plan_generated` with:
  - `race_distance`
  - `goal_time`
  - `pacing_strategy` (even/negative/positive)
  - `fueling_steps`
  - `safety_flags`
  - `weather_adjusted` (boolean)

## Common edge cases
- **First race ever**: Extra conservative pacing, finish-focused strategy
- **No goal time**: Suggest comfortable effort-based approach
- **Undertrained**: Recommend race deferral or fun run approach
- **Recent injury**: Strongly advise caution or skipping
- **Multiple goals (A/B/C)**: Provide tiered pacing plans
- **Relay or team race**: Adjust strategy for shorter effort

## Testing considerations
- Test with various race distances (5K to marathon)
- Verify pacing calculation accuracy
- Test fueling recommendations for different distances
- Validate contingency plans appropriateness
- Test with missing data (no recent races)
- Verify SafetyFlag emission for risky scenarios
