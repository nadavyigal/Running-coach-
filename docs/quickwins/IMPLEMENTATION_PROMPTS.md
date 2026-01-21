# 5 Quick Wins - Implementation Prompts

This document contains ready-to-use prompts for implementing each quick win. Copy these prompts into Codex or Claude Code to execute each phase.

---

## Setup Phase: Feature Branch & Flags

### Prompt 1: Initialize Project
```
I need to set up the implementation environment for 5 quick wins features:

1. Create a new feature branch: `feature/5-quick-wins` from current branch
2. Create feature flag configuration in `v0/lib/featureFlags.ts`:
   - Add flags: ENABLE_AUTO_PAUSE, ENABLE_PACE_CHART, ENABLE_VIBRATION_COACH, ENABLE_WEEKLY_RECAP, ENABLE_COMPLETION_LOOP
   - Each flag should read from environment variable (NEXT_PUBLIC_*)
   - Default: all false
3. Create `.env.local.example` file showing all required environment variables
4. Commit the setup with message: "feat: initialize 5 quick wins feature flags"

Reference: C:\Users\nadav\.claude\plans\sparkling-splashing-marshmallow.md
```

---

## Quick Win #1: Auto-Pause + GPS Quality

### Prompt 2A: Auto-Pause State Machine
```
Implement auto-pause functionality in the run recording system:

CONTEXT:
- File: v0/components/record-screen.tsx
- Existing GPS tracking uses useGpsTracking hook
- Current implementation tracks speed but doesn't auto-pause

IMPLEMENTATION:
1. Add auto-pause state variables:
   - autoPauseActive: boolean
   - autoPauseStartTime: number | null
   - autoPauseCount: number
   - Speed threshold: 0.5 m/s for pause trigger, 1.0 m/s for resume

2. Add auto-pause detection logic in recordPointForActiveRun():
   - Calculate current speed from GPS points
   - If speed < 0.5 m/s for 5 consecutive seconds → trigger auto-pause
   - If speed > 1.0 m/s → clear auto-pause
   - Do NOT increment distance during auto-pause

3. Add visual indicator:
   - Show "Auto-Paused" banner when active
   - Display pause count in run stats
   - Add orange indicator to GPS status

4. Add analytics events:
   - auto_pause_triggered (properties: duration_seconds, gps_accuracy)
   - auto_pause_resumed (properties: pause_count)

REQUIREMENTS:
- Must NOT break existing manual pause/resume
- Distance should freeze during auto-pause
- Time should continue counting
- Feature must be behind ENABLE_AUTO_PAUSE flag

TEST:
- Walk slowly (< 0.5 m/s) for 5 seconds → verify auto-pause triggers
- Resume running → verify auto-pause clears
- Check distance does not increase during pause

COMMIT: "feat(gps): add auto-pause on slow speed detection"
```

### Prompt 2B: GPS Quality Score
```
Add GPS quality scoring to run reports:

CONTEXT:
- File: v0/lib/gps-monitoring.ts (existing GPS monitoring service)
- File: v0/app/api/run-report/route.ts (run report generation)
- GPS accuracy data stored in runs table: gpsAccuracyData, averageAccuracy

IMPLEMENTATION:
1. Add GPS quality score calculation in gps-monitoring.ts:
   - Function: calculateGPSQualityScore(accuracyData: GPSAccuracyData[]): number
   - Score 0-100 based on:
     * Average accuracy (weight: 40%)
     * Accuracy variance (weight: 30%)
     * % of points < 20m accuracy (weight: 30%)
   - Classification: Excellent (90-100), Good (75-89), Fair (60-74), Poor (0-59)

2. Update run report API to include GPS quality:
   - Calculate GPS quality score from run.gpsAccuracyData
   - Add to report structure: gpsQuality: { score: number, level: string, averageAccuracy: number }
   - Include in AI prompt context (so AI can reference GPS reliability)

3. Update run-report-screen.tsx to display GPS quality:
   - Add "GPS Quality" card below run stats
   - Show score as progress bar (color-coded)
   - Show classification badge (Excellent/Good/Fair/Poor)

4. Add analytics event:
   - gps_quality_score (properties: score, confidence_level, run_id)

REQUIREMENTS:
- Must handle runs with missing GPS data gracefully
- Score calculation must be fast (< 50ms)
- Feature behind ENABLE_AUTO_PAUSE flag

TEST:
- Mock runs with perfect GPS (5m accuracy) → score should be 95+
- Mock runs with poor GPS (100m accuracy) → score should be < 50

COMMIT: "feat(gps): add GPS quality scoring to run reports"
```

---

## Quick Win #2: Pace Chart & Enhanced Sharing

### Prompt 3A: Pace Calculation Utilities
```
Create pace calculation and smoothing utilities:

CONTEXT:
- GPS data stored as gpsPath: array of {lat, lng, timestamp, accuracy}
- Need to calculate pace for each segment and smooth noise

IMPLEMENTATION:
Create new file: v0/lib/pace-calculations.ts

1. Function: calculateSegmentPaces(gpsPath: GPSPoint[]): PaceData[]
   - For each segment i, calculate: pace = (time[i] - time[i-1]) / (distance[i] - distance[i-1])
   - Distance using Haversine formula (import from routeUtils.ts)
   - Return: { distanceKm: number, paceMinPerKm: number, timestamp: Date }[]

2. Function: smoothPaceData(paceData: PaceData[], windowSize = 3): PaceData[]
   - Apply moving average smoothing
   - Formula: pace_smoothed[i] = (pace[i-1] + pace[i] + pace[i+1]) / 3
   - Handle edge cases (first/last points)

3. Function: downsamplePaceData(paceData: PaceData[], maxPoints = 200): PaceData[]
   - If data.length > maxPoints, take every Nth point
   - Preserve first and last points always

4. Function: classifyPaceZone(pace: number, userPaces: UserPaces): 'easy' | 'moderate' | 'hard'
   - Compare against user.easyPace, user.tempoPace thresholds
   - Return zone classification

5. Add TypeScript interfaces:
   - PaceData: { distanceKm, paceMinPerKm, timestamp }
   - UserPaces: { easyPace, tempoPace }

REQUIREMENTS:
- Must handle GPS gaps gracefully (skip invalid segments)
- Smoothing must not shift data significantly
- Performance: < 100ms for 1000 GPS points

TEST:
- Test with mock GPS data (100 points, steady pace)
- Test with noisy GPS data (pace spikes)
- Verify smoothing reduces variance

COMMIT: "feat(pace): add pace calculation and smoothing utilities"
```

### Prompt 3B: Continuous Pace Chart Component
```
Build SVG-based continuous pace line chart:

CONTEXT:
- Use pace data from pace-calculations.ts
- Display on run-report-screen.tsx
- Mobile-first, responsive design

IMPLEMENTATION:
Create new file: v0/components/pace-chart.tsx

1. Component: PaceChart
   - Props: { gpsPath: GPSPoint[], userPaces?: UserPaces }
   - Calculate pace data using calculateSegmentPaces()
   - Apply smoothing with smoothPaceData()
   - Downsample to max 200 points

2. SVG Line Chart:
   - Responsive width (100% container)
   - Height: 300px
   - X-axis: distance (km) with labels every 1km
   - Y-axis: pace (min/km) with 30s intervals
   - Color: blue line, 2px stroke
   - Background zones (optional): green (easy), yellow (moderate), red (hard)

3. Interactive features:
   - On tap/click: show tooltip with exact pace/distance
   - Tooltip: "5:23 min/km at 3.2km"
   - Crosshair on hover (desktop only)

4. Edge cases:
   - No GPS data: show "GPS data unavailable" message
   - < 10 points: show "Insufficient data for chart"
   - Loading state: skeleton placeholder

REQUIREMENTS:
- Must be responsive (mobile + desktop)
- No external chart library dependencies (pure SVG)
- Render time: < 500ms for 1000 points
- Feature behind ENABLE_PACE_CHART flag

TEST:
- Render with 100, 500, 1000 GPS points → verify performance
- Tap on chart → verify tooltip shows correct data
- Test on mobile (Chrome Android)

COMMIT: "feat(pace): add continuous pace line chart component"
```

### Prompt 3C: Enhanced Run Report AI
```
Enhance run report AI prompt to include pacing analysis:

CONTEXT:
- File: v0/app/api/run-report/route.ts
- Current AI generates basic insights (effort, recovery, next session)
- Need to add pacing analysis section

IMPLEMENTATION:
1. Update AI prompt template (line ~50-100):
   - Add input: paceData (from pace-calculations.ts)
   - Calculate pace statistics:
     * Average pace
     * Pace variability (standard deviation)
     * First/last km pace (for split analysis)

2. Add "Pacing Analysis" section to prompt:
   """
   Analyze the runner's pacing strategy:
   - Was the pace consistent, fading (positive split), or negative split?
   - Average pace: {avgPace}, pace range: {minPace}-{maxPace}
   - Pace variability: {stdDev} (low = consistent, high = erratic)
   - Provide 1-2 sentence pacing assessment
   - If pacing was poor, suggest specific improvement
   """

3. Update RunInsight schema to include:
   - pacingAnalysis?: string
   - paceConsistency?: 'consistent' | 'fading' | 'negative-split' | 'erratic'
   - paceVariability?: number

4. Update run-report-screen.tsx:
   - Display pacing analysis in a new card
   - Show pace consistency badge
   - Highlight variability if high (> 30s variance)

REQUIREMENTS:
- AI response should be concise (1-2 sentences max)
- Must handle runs without pace data gracefully
- Feature behind ENABLE_PACE_CHART flag

TEST:
- Mock run with consistent pace → AI should recognize
- Mock run with fading pace → AI should identify and suggest even pacing

COMMIT: "feat(ai): enhance run report with pacing analysis"
```

### Prompt 3D: HTML Snapshot Sharing
```
Add HTML snapshot generation for sharing runs:

CONTEXT:
- File: v0/components/share-run-modal.tsx
- Currently shares text-only via social media
- Need to generate rich HTML snapshot with pace chart

IMPLEMENTATION:
1. Function: generateHTMLSnapshot(run: Run, paceChartSVG: string): string
   - Create HTML template with:
     * Run stats table (distance, duration, pace, date)
     * Inline SVG pace chart (embed directly in HTML)
     * AI insights summary (1-2 key points)
   - Styling: inline CSS for portability
   - Format: clean, mobile-friendly layout

2. Update share-run-modal.tsx:
   - Add "Share as Snapshot" button
   - On click: generate HTML snapshot
   - Use Web Share API if available (navigator.share())
   - Share format: { title: "My Run", text: summary, url: shareableLink }
   - Fallback: copy HTML to clipboard with success toast

3. Share content text format:
   "I just ran {distance}km in {duration} at {pace} pace! 🏃
   {top_insight_summary}

   View full report: {shareableLink}"

4. Add analytics event:
   - run_report_shared (properties: share_method: 'native_share' | 'clipboard')

REQUIREMENTS:
- HTML must be self-contained (no external resources)
- Web Share API detection and fallback
- Feature behind ENABLE_PACE_CHART flag

TEST:
- Generate snapshot on mobile → verify Web Share API triggers
- Generate snapshot on desktop → verify clipboard copy works
- Open shared HTML → verify chart renders correctly

COMMIT: "feat(share): add HTML snapshot generation for run sharing"
```

---

## Quick Win #3: Vibration Alerts

### Prompt 4A: Vibration API Wrapper
```
Create vibration API wrapper for haptic feedback:

CONTEXT:
- Web Vibration API: navigator.vibrate(pattern)
- Need cross-browser compatibility and feature detection

IMPLEMENTATION:
Create new file: v0/lib/vibration-coach.ts

1. Function: isVibrationSupported(): boolean
   - Check if navigator.vibrate exists
   - Return true if supported

2. Function: vibrateSingle(duration = 100): void
   - Trigger single vibration pulse
   - Default duration: 100ms
   - Silently fail if unsupported

3. Function: vibrateDouble(): void
   - Pattern: [100, 50, 100] (vibrate 100ms, pause 50ms, vibrate 100ms)
   - Used for workout completion

4. Function: vibrateAlert(): void
   - Pattern: [200, 100, 200] (stronger alert)
   - Used for pace alerts (if implemented)

5. Preference check:
   - Check localStorage: vibrationEnabled (default: true)
   - Function: isVibrationEnabled(): boolean
   - Function: setVibrationEnabled(enabled: boolean): void

REQUIREMENTS:
- Must handle unsupported browsers gracefully (no errors)
- Must respect user preference setting
- Feature behind ENABLE_VIBRATION_COACH flag

TEST:
- Call vibrateSingle() on supported device → verify vibration occurs
- Call on desktop browser → verify no error thrown
- Disable in settings → verify vibration stops

COMMIT: "feat(vibration): add vibration API wrapper"
```

### Prompt 4B: Interval Timer UI
```
Add visual interval timer to record screen:

CONTEXT:
- File: v0/components/record-screen.tsx
- Workouts can have intervals (from plan)
- Need to show current phase and countdown

IMPLEMENTATION:
1. Parse workout structure from today's workout:
   - Extract phases from workout.notes (e.g., "3x1km @ tempo, 2min recovery")
   - Create interval structure: { type: 'warmup' | 'interval' | 'recovery' | 'cooldown', duration?: number, distance?: number }[]

2. Add interval timer state:
   - currentPhase: number (index in intervals array)
   - phaseStartTime: Date
   - phaseElapsed: number
   - nextPhaseIn: number (seconds remaining)

3. UI Components:
   - Add "Interval Timer" card above run stats (conditionally shown if workout has intervals)
   - Display: "Interval 2 of 5 - Tempo Run"
   - Progress bar showing phase completion
   - Countdown: "Next: Recovery in 1:23"

4. Phase transitions:
   - When phase completes → vibrateSingle()
   - Update currentPhase index
   - Analytics: vibration_cue_triggered (cue_type: 'interval_start' | 'interval_end')

5. Settings toggle:
   - Add "Vibration Cues" toggle in record screen settings
   - Save to localStorage

REQUIREMENTS:
- Must parse common workout formats from notes
- Timer must continue during manual pause (pause interval timer too)
- Feature behind ENABLE_VIBRATION_COACH flag

TEST:
- Start workout with intervals → verify timer shows
- Complete interval phase → verify vibration triggers
- Disable vibration → verify no vibration but timer still works

COMMIT: "feat(intervals): add visual interval timer with vibration cues"
```

---

## Quick Win #4: Weekly Recap

### Prompt 5A: Weekly Recap Data Model
```
Create weekly recap data generation:

CONTEXT:
- File: v0/lib/habitAnalytics.ts (existing habit analytics)
- Need to generate weekly summary for Monday notifications

IMPLEMENTATION:
1. Add TypeScript interface:
```typescript
interface WeeklyRecap {
  weekStartDate: Date;
  weekEndDate: Date;
  totalDistance: number;
  totalRuns: number;
  totalDuration: number;
  averagePace: string;
  weekOverWeekChange: { distance: number; runs: number }; // % change
  streakStatus: 'continued' | 'broken' | 'started';
  currentStreak: number;
  topAchievement: string;
  consistencyScore: number; // 0-100
  nextWeekGoal: string;
}
```

2. Function: generateWeeklyRecap(userId: number, weekStartDate: Date): Promise<WeeklyRecap>
   - Query runs from Dexie for current week (Mon 00:00 - Sun 23:59)
   - Calculate totals (distance, runs, duration)
   - Calculate average pace
   - Query previous week for comparison
   - Calculate week-over-week % change
   - Get streak status from user record
   - Identify top achievement (longest run, best pace, etc.)
   - Calculate consistency score (runs completed / runs planned * 100)
   - Generate next week goal (simple heuristic: +10% distance if consistent, maintain if not)

3. Caching:
   - Cache result in localStorage: `weeklyRecap_${userId}_${weekStartDate}`
   - TTL: 24 hours
   - Function: getCachedWeeklyRecap(): WeeklyRecap | null

REQUIREMENTS:
- Must handle weeks with zero runs gracefully
- Performance: < 200ms for 100 runs
- Feature behind ENABLE_WEEKLY_RECAP flag

TEST:
- Generate recap with 5 runs → verify stats match
- Generate recap with 0 runs → verify empty state
- Test week-over-week comparison (increase/decrease)

COMMIT: "feat(recap): add weekly recap data model and generation"
```

### Prompt 5B: Weekly Recap Widget
```
Create collapsible weekly recap widget for Today screen:

CONTEXT:
- File: v0/components/today-screen.tsx
- Display below "Today's Workout" card
- Should be collapsed by default

IMPLEMENTATION:
Create new file: v0/components/weekly-recap-widget.tsx

1. Component: WeeklyRecapWidget
   - Fetch weekly recap data on mount (from habitAnalytics.ts)
   - State: expanded (boolean), loading (boolean)

2. Compact view (collapsed):
   - Card header: "This Week's Progress 📊"
   - Stats: "{totalRuns} runs • {totalDistance}km"
   - Streak badge: "🔥 {currentStreak} week streak"
   - Expand icon (chevron down)

3. Expanded view:
   - Week date range: "Jan 13 - Jan 19"
   - Stats grid:
     * Total distance with week-over-week badge (+15% ↑ or -5% ↓)
     * Total runs with comparison
     * Average pace
   - Mini bar chart: 7 days (Mon-Sun) showing run count per day
   - Consistency score: circular progress indicator
   - "View Full Recap" button → opens modal

4. Empty state:
   - If totalRuns = 0: "No runs this week yet. Let's get moving! 🏃"

5. Analytics:
   - weekly_recap_viewed (properties: week_start_date, total_runs)

REQUIREMENTS:
- Must be responsive (mobile-first)
- Smooth expand/collapse animation
- Feature behind ENABLE_WEEKLY_RECAP flag

TEST:
- View on Monday → verify shows current week data
- Expand widget → verify animation smooth
- Test empty state (no runs)

COMMIT: "feat(recap): add weekly recap collapsible widget"
```

### Prompt 5C: Weekly Recap Modal
```
Create full-screen weekly recap modal:

CONTEXT:
- Opened from weekly recap widget "View Full Recap" button
- Show detailed breakdown and achievements

IMPLEMENTATION:
Create new file: v0/components/weekly-recap-modal.tsx

1. Component: WeeklyRecapModal
   - Props: { isOpen, onClose, weeklyRecap: WeeklyRecap }
   - Full-screen modal with sections

2. Sections:
   a) Header:
      - Week date range
      - Close button

   b) Overview:
      - Hero stat: total distance (large, prominent)
      - Stats grid: runs, duration, average pace
      - Week-over-week comparison with arrow indicators

   c) Daily Breakdown:
      - Bar chart: 7 columns (Mon-Sun)
      - Show distance per day
      - Tap bar to see day details

   d) Achievements:
      - Top achievement highlighted (e.g., "Longest run: 10km")
      - Streak status: "Continued 4-week streak!" or "Streak broken"
      - Personal records if any

   e) Next Week Preview:
      - Suggested goal: "Try 25km next week (+10%)"
      - Consistency tip based on score

3. Share button:
   - "Share My Week" → generates text summary
   - Format: "I ran {distance}km this week across {runs} runs! {topAchievement}"

4. Analytics:
   - weekly_recap_modal_opened (properties: week_start_date)

REQUIREMENTS:
- Smooth modal animation (slide up from bottom)
- Accessible (keyboard navigation, screen readers)
- Feature behind ENABLE_WEEKLY_RECAP flag

TEST:
- Open modal → verify all sections render
- Test with zero runs → verify encouragement message
- Share button → verify text generates correctly

COMMIT: "feat(recap): add full weekly recap modal"
```

### Prompt 5D: Monday Morning Notification
```
Add Monday morning notification trigger:

CONTEXT:
- File: v0/lib/engagement-optimization.ts (existing engagement logic)
- Should check on app open every Monday at 7am

IMPLEMENTATION:
Create new file: v0/lib/weekly-recap-scheduler.ts

1. Function: shouldShowWeeklyRecapNotification(): boolean
   - Check current day: if Monday
   - Check time: if between 7am-9am local time
   - Check localStorage: lastRecapNotificationDate
   - Return true if not shown this week yet

2. Function: markRecapNotificationShown(): void
   - Save to localStorage: lastRecapNotificationDate = now
   - Prevents duplicate notifications

3. In-app notification banner:
   - Component: WeeklyRecapNotificationBanner
   - Display at top of Today screen
   - Message: "Your weekly recap is ready! 🎉"
   - CTA button: "View Recap" → scrolls to recap widget or opens modal
   - Auto-dismiss after 10 seconds
   - Manual dismiss: close button

4. Trigger logic in today-screen.tsx:
   - On component mount: check shouldShowWeeklyRecapNotification()
   - If true: show banner, call markRecapNotificationShown()
   - Analytics: weekly_recap_notification_shown (notification_type: 'monday_morning')

REQUIREMENTS:
- Must respect user timezone (use browser local time)
- Must not spam (once per week maximum)
- Banner must be dismissible
- Feature behind ENABLE_WEEKLY_RECAP flag

TEST:
- Mock Monday 7am → verify banner appears
- Dismiss banner → verify doesn't reappear on refresh
- Mock Tuesday → verify banner doesn't appear

COMMIT: "feat(recap): add Monday morning weekly recap notification"
```

---

## Quick Win #5: Workout Completion Loop

### Prompt 6A: Workout Matching Logic
```
Add workout completion detection and confirmation:

CONTEXT:
- File: v0/lib/run-recording.ts (save run function)
- Workouts stored in database with planId, day, type, distanceKm
- Need to match completed runs to planned workouts

IMPLEMENTATION:
1. Function: findMatchingWorkout(run: Run): Workout | null
   - Query workouts for today's date
   - Check if workout not already completed
   - Matching criteria:
     * Type must match exactly (easy, tempo, intervals, etc.)
     * Distance within 20% tolerance: abs(run.distance - workout.distanceKm) / workout.distanceKm <= 0.20
   - Return matching workout or null

2. Update recordRunWithSideEffects() function:
   - After saving run to database
   - Call findMatchingWorkout(run)
   - If match found:
     * Update workout.isCompleted = true
     * Update workout.completedAt = now
     * Update workout.actualDistanceKm = run.distance
     * Update workout.actualDurationMinutes = run.duration / 60
     * Update workout.actualPace = run.pace
   - Store matchedWorkoutId in return value

3. Return enhanced result:
   ```typescript
   {
     runId: number;
     matchedWorkout?: Workout;
     adaptationNeeded: boolean;
   }
   ```

4. Analytics:
   - workout_completion_confirmed (properties: workout_id, matched_plan_workout: boolean, distance_variance_pct)

REQUIREMENTS:
- Must not match if workout already completed
- Must handle multiple workouts on same day (rare)
- Must be performant (< 50ms)
- Feature behind ENABLE_COMPLETION_LOOP flag

TEST:
- Complete run matching planned workout → verify workout marked completed
- Complete run NOT matching → verify no workout updated
- Complete run with 25% distance variance → verify no match (outside tolerance)

COMMIT: "feat(completion): add workout matching and completion logic"
```

### Prompt 6B: Completion Celebration Modal
```
Create workout completion celebration modal:

CONTEXT:
- Shown immediately after run is saved IF workout matched
- Celebrate achievement and show next workout

IMPLEMENTATION:
Create new file: v0/components/workout-completion-modal.tsx

1. Component: WorkoutCompletionModal
   - Props: { isOpen, onClose, completedWorkout: Workout, nextWorkout?: Workout }
   - Full-screen modal with celebration theme

2. Modal content:
   a) Celebration header:
      - Confetti animation (use existing milestone-celebration.tsx pattern)
      - Message: "Workout Completed! 🎉"
      - Workout type badge (e.g., "Tempo Run")

   b) Stats comparison:
      - Planned vs Actual in side-by-side format:
        * Distance: "Planned: 8km | You: 8.2km ✓"
        * Duration: "Planned: 48min | You: 47min ✓"
        * Pace: "Target: 6:00 | You: 5:45 ⚡" (with indicator if faster/slower)

   c) Encouragement message:
      - Random selection from motivational messages:
        * "Great job sticking to the plan!"
        * "You're building consistent habits!"
        * "Your training is on track!"

   d) Next workout preview (if available):
      - Card: "What's Next?"
      - Show next workout: "{day} - {type} - {distance}km"
      - Button: "View Full Plan"

3. Vibration:
   - Trigger vibrateDouble() on modal open

4. Analytics:
   - workout_completion_modal_viewed (properties: workout_id, workout_type)
   - next_workout_previewed (properties: next_workout_type, days_until)

REQUIREMENTS:
- Must be visually celebratory (confetti, colors)
- Must auto-dismiss after 8 seconds or manual close
- Feature behind ENABLE_COMPLETION_LOOP flag

TEST:
- Complete matching workout → verify modal appears
- Check stats comparison → verify "planned vs actual" accurate
- Check next workout preview → verify correct workout shown

COMMIT: "feat(completion): add workout completion celebration modal"
```

### Prompt 6C: Plan Adaptation Trigger
```
Connect workout completion to plan adaptation:

CONTEXT:
- File: v0/app/api/plan/adapt/route.ts (existing plan adaptation API)
- Should trigger after workout completion if adaptation needed
- Use existing adaptation logic (conservative safety caps)

IMPLEMENTATION:
1. Update run-recording.ts recordRunWithSideEffects():
   - After workout marked completed
   - Check if adaptation needed:
     * If actualPace significantly slower than targetPace (> 30 sec/km difference)
     * If actualDistance < plannedDistance by 20%+
     * If user is on consecutive missed workouts streak

2. Adaptation trigger logic:
   ```typescript
   if (matchedWorkout && shouldTriggerAdaptation(run, matchedWorkout)) {
     // Call adaptation API asynchronously (don't block run save)
     await fetch('/api/plan/adapt', {
       method: 'POST',
       body: JSON.stringify({
         planId: matchedWorkout.planId,
         recentRun: run,
         adaptationReason: determineAdaptationReason(run, matchedWorkout)
       })
     });
   }
   ```

3. Function: determineAdaptationReason(): string
   - Return reason: 'performance_below_target' | 'distance_not_met' | 'consecutive_misses'

4. Show adaptation notification:
   - If adaptation occurred, show toast notification
   - Message: "Plan updated based on your recent performance"
   - Link: "View Changes"

5. Analytics:
   - plan_adapted (properties: adaptation_reason, plan_id, trigger: 'workout_completion')

REQUIREMENTS:
- Must not block run saving (async adaptation)
- Must handle API errors gracefully (log but don't fail)
- Must respect existing safety caps in adaptation API
- Feature behind ENABLE_COMPLETION_LOOP flag

TEST:
- Complete workout significantly slower → verify adaptation triggers
- Complete workout on target → verify no adaptation
- Mock API error → verify run still saves successfully

COMMIT: "feat(completion): connect workout completion to plan adaptation"
```

---

## Testing Phase

### Prompt 7A: Create Mock GPS Test Data
```
Create mock GPS test data files for testing:

CONTEXT:
- Need various GPS scenarios to test features
- Files will go in v0/dev/ directory

IMPLEMENTATION:
Create 4 JSON files with GPS test data:

1. v0/dev/golden-run.json:
   - Perfect GPS data
   - 5km run, 100 points
   - Accuracy: 5-8 meters consistently
   - Steady pace: 5:30 min/km
   - No speed spikes or gaps

2. v0/dev/poor-gps.json:
   - High variability GPS
   - 5km run, 100 points
   - Accuracy: 50-120 meters (variable)
   - Pace spikes: random 4:00-8:00 min/km
   - Some accuracy > 100m (should be filtered)

3. v0/dev/auto-pause-test.json:
   - Includes stationary periods
   - 5km run, 120 points
   - 3 stationary periods (speed < 0.5 m/s for 5+ seconds)
   - Accuracy: 10-15 meters
   - Should trigger auto-pause 3 times

4. v0/dev/interval-run.json:
   - Interval workout
   - 8km run, 150 points
   - Pattern: warmup (slow), 4x (fast, slow recovery), cooldown
   - Clear pace zones for testing pace chart

Format for each file:
```json
{
  "name": "Test Run Name",
  "description": "Description of test scenario",
  "gpsPath": [
    { "lat": 40.7128, "lng": -74.0060, "timestamp": "2024-01-15T10:00:00Z", "accuracy": 5 },
    ...
  ],
  "expectedDistance": 5.0,
  "expectedPace": "5:30"
}
```

COMMIT: "test: add mock GPS test data files"
```

### Prompt 7B: Integration Testing
```
Create integration tests for quick wins features:

CONTEXT:
- Use Vitest framework (existing setup)
- Test files co-located with components

IMPLEMENTATION:

1. Create v0/components/record-screen.autopause.test.tsx:
   - Test auto-pause triggers when speed < 0.5 m/s for 5 seconds
   - Test auto-pause clears when speed > 1.0 m/s
   - Test distance does not increment during auto-pause
   - Test auto-pause count increments correctly
   - Use auto-pause-test.json mock data

2. Create v0/lib/pace-calculations.test.ts:
   - Test calculateSegmentPaces() with golden-run.json
   - Test smoothPaceData() reduces variance
   - Test downsamplePaceData() preserves shape
   - Test classifyPaceZone() returns correct zones

3. Create v0/components/pace-chart.test.tsx:
   - Test chart renders with valid data
   - Test chart handles empty data gracefully
   - Test downsample works for large datasets (1000+ points)
   - Test tooltip shows on interaction

4. Create v0/lib/habitAnalytics.weeklyrecap.test.ts:
   - Test generateWeeklyRecap() calculates totals correctly
   - Test week-over-week comparison (increase/decrease)
   - Test handles zero runs gracefully
   - Test consistency score calculation

5. Create v0/lib/run-recording.completion.test.ts:
   - Test findMatchingWorkout() matches correctly
   - Test 20% distance tolerance
   - Test type matching requirement
   - Test false positives (different type, out of tolerance)

Run all tests:
```bash
cd v0
npm run test -- --run
```

REQUIREMENTS:
- All tests must pass
- Coverage target: 80%+ for new code
- Tests must run in < 10 seconds total

COMMIT: "test: add integration tests for quick wins features"
```

### Prompt 7C: Manual QA Testing
```
Perform manual QA testing of all quick wins:

Use the manual test cases from plan document:
- Reference: C:\Users\nadav\.claude\plans\sparkling-splashing-marshmallow.md (Phase 9)

TESTING CHECKLIST:

Quick Win #1 - Auto-Pause:
- [ ] Load auto-pause-test.json in record screen
- [ ] Verify auto-pause triggers 3 times
- [ ] Verify distance freezes during pause
- [ ] Check GPS quality score calculation

Quick Win #2 - Pace Chart:
- [ ] Complete run with golden-run.json
- [ ] Verify pace chart renders smoothly
- [ ] Tap on chart points → verify tooltip
- [ ] Test share functionality (Web Share API on mobile)

Quick Win #3 - Vibration:
- [ ] Start interval-run.json
- [ ] Verify vibration at phase transitions (if device supports)
- [ ] Test on device without vibration → graceful degradation
- [ ] Toggle vibration setting → verify respects preference

Quick Win #4 - Weekly Recap:
- [ ] View Today screen → verify recap widget shows
- [ ] Expand widget → verify stats match test data
- [ ] Open full modal → verify all sections render
- [ ] Test Monday notification (mock date)

Quick Win #5 - Completion Loop:
- [ ] Complete run matching planned workout
- [ ] Verify completion modal appears
- [ ] Verify workout marked completed in database
- [ ] Check "What's Next?" preview

MOBILE TESTING:
- Test on Chrome Android (priority 1)
- Test on Safari iOS (priority 1)

PERFORMANCE:
- Check page load time: < 2s on 3G
- Check pace chart render: < 500ms for 1000 points

DOCUMENT FINDINGS:
- Create v0/docs/qa-test-results.md
- Note any bugs found
- Create GitHub issues for bugs

COMMIT: "docs: add QA test results for quick wins"
```

---

## Deployment Phase

### Prompt 8: Enable Feature Flags & Deploy
```
Enable feature flags and deploy to production:

CONTEXT:
- All features implemented and tested
- Ready for gradual rollout

IMPLEMENTATION:

1. Update .env.local:
```
NEXT_PUBLIC_ENABLE_AUTO_PAUSE=true
NEXT_PUBLIC_ENABLE_PACE_CHART=true
NEXT_PUBLIC_ENABLE_VIBRATION_COACH=true
NEXT_PUBLIC_ENABLE_WEEKLY_RECAP=true
NEXT_PUBLIC_ENABLE_COMPLETION_LOOP=true
```

2. Update Vercel environment variables:
   - Go to Vercel dashboard → Settings → Environment Variables
   - Add all 5 flags (initially set to 'false' for safety)
   - Will enable in phases

3. Commit and push:
```bash
git add .
git commit -m "feat: enable 5 quick wins features (behind flags)"
git push origin feature/5-quick-wins
```

4. Create pull request:
   - Title: "feat: 5 Quick Wins - GPS Auto-Pause, Pace Charts, Vibration, Weekly Recap, Completion Loop"
   - Description: Link to plan document, summary of features
   - Request review

5. Merge to main after approval

6. Monitor deployment:
   - Check Vercel deployment logs
   - Verify no errors in production
   - Check PostHog for analytics events

7. Gradual rollout (edit Vercel env vars):
   - Day 1: Enable ENABLE_AUTO_PAUSE to 10% (using Vercel percentage rollout)
   - Day 2: Monitor error rates, enable to 25%
   - Day 3: Enable all flags to 50%
   - Day 4: Full rollout 100%

MONITORING:
- Check error rate: should be < 1% increase
- Check PostHog events: verify all 11 new events firing
- Check user feedback channels

ROLLBACK PLAN:
- If critical issues: disable feature flags in Vercel (instant rollback)

COMMIT: N/A (deployment via Vercel)
```

---

## Summary

### Implementation Order
1. ✅ Setup: Feature branch + flags (Prompt 1)
2. ✅ Quick Win #1: Auto-Pause (Prompts 2A, 2B)
3. ✅ Quick Win #2: Pace Chart (Prompts 3A, 3B, 3C, 3D)
4. ✅ Quick Win #3: Vibration (Prompts 4A, 4B)
5. ✅ Quick Win #4: Weekly Recap (Prompts 5A, 5B, 5C, 5D)
6. ✅ Quick Win #5: Completion Loop (Prompts 6A, 6B, 6C)
7. ✅ Testing: Mock data + tests (Prompts 7A, 7B, 7C)
8. ✅ Deployment: Enable flags + rollout (Prompt 8)

### Estimated Time
- Day 1-2: Quick Win #1 (6 hours)
- Day 3-4: Quick Win #2 (8 hours)
- Day 5: Quick Win #3 (4 hours)
- Day 6-7: Quick Win #4 (6 hours)
- Day 8-9: Quick Win #5 (5 hours)
- Day 10: Testing + deployment (6 hours)

**Total: 35-40 hours**

### Success Criteria
- ✅ All 5 quick wins implemented
- ✅ All tests passing (80%+ coverage)
- ✅ No critical bugs
- ✅ Analytics events firing
- ✅ Performance benchmarks met
- ✅ Feature flags working
- ✅ Gradual rollout completed

---

**Plan Document:** `C:\Users\nadav\.claude\plans\sparkling-splashing-marshmallow.md`
**Implementation Prompts:** This document
**Test Data:** `v0/dev/*.json` (to be created)
