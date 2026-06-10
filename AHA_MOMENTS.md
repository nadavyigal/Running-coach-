# AHA_MOMENTS.md — RunSmart Aha Moment System

> **Objective:** Transform a new user from "this is an app" to "this is MY app" within their first session and first run. Each moment is emotionally resonant, fires early, and requires minimal data to deliver.

---

## Design Principles

1. **Minimum data, maximum feeling** — each moment works with 1-3 data points
2. **Never feel algorithmic** — copy sounds human, not generated
3. **One moment per scene** — never stack two aha moments in the same screen transition
4. **Irreversible identity** — moments assign meaning, not just facts
5. **Progressive trust** — each moment builds on the last; they form a system, not isolated features

---

## Moment Sequencing Strategy

```
Session 1 (Onboarding)
├── Moment #1 fires: "This knows me"         ← after onboarding Q&A
└── Moment #3 fires: "I can see where I'm going"  ← after goal-setting step

Session 1 (First Run)
└── Moment #2 fires: "I just did something I didn't think I could"

Session 2+ (Any Run with notable context)
└── Moment #4 fires: "Someone noticed"
    └── Re-fires with new context; never identical copy
```

**Sequencing rules:**
- Max 1 aha moment per distinct scene (screen transition)
- Moments #1 and #3 can fire in the same session but never the same screen
- Moment #4 re-fires on different contexts, minimum 3-day gap between firings
- If the first run is skipped during Session 1, Moment #2 fires on the next qualifying run
- Moments never expire — they wait for the right trigger

---

## Shared Infrastructure

### AhaMomentEngine (service)

Central orchestrator. Responsibilities:
- Track which moments have fired per user (and when)
- Manage firing queue: max 1 per scene
- Provide `getNextMoment(context)` API used by all trigger points
- Persist state to Supabase `user_aha_moments` table

```typescript
interface AhaMomentState {
  userId: string;
  momentId: 'knows_me' | 'achievement' | 'future_vision' | 'noticed';
  firedAt: string | null;
  variant: string;        // A/B variant assigned
  dismissed: boolean;
  ctaClicked: boolean;
}
```

### AhaMomentOverlay (component)

Reusable full-screen or bottom-sheet overlay used by Moments #1, #2, #3.

Props:
- `headline: string`
- `subline: string`
- `cta?: { label: string; action: () => void }`
- `visual?: 'identity_badge' | 'achievement_ring' | 'timeline' | 'spotlight'`
- `onDismiss: () => void`
- `autoDismissMs?: number`

### UserInsightService (service)

Calculates all inputs needed by moment logic:
- `getRunningIdentity(pace, goal, experience)` → `'endurance' | 'speed' | 'comeback' | 'first_timer' | 'balanced'`
- `detectRunContext(run, history)` → `RunContext | null`
- `projectGoalTimeline(pace, fitnessLevel, targetDistanceKm)` → `{ weeks: number; milestoneWeek: number }`

### PostHog Event Schema (shared across all moments)

```
aha_moment_fired: {
  moment_id: string,
  variant: string,
  context?: string,           // for 'noticed': which context fired
  trigger_event: string,      // 'onboarding_complete' | 'first_run' | 'run_complete' | etc.
  session_number: number,
  is_first_run: boolean
}

aha_moment_cta_clicked: { moment_id, variant }
aha_moment_dismissed:   { moment_id, variant, time_to_dismiss_ms }
aha_moment_shared:      { moment_id, variant, context? }
```

### Database Schema (new tables required)

```sql
-- Track moment state per user
CREATE TABLE user_aha_moments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users NOT NULL,
  moment_id     TEXT NOT NULL,  -- 'knows_me' | 'achievement' | 'future_vision' | 'noticed'
  context       TEXT,           -- for 'noticed': 'streak_7' | 'early_morning' | etc.
  variant       TEXT,           -- A/B variant
  fired_at      TIMESTAMPTZ DEFAULT NOW(),
  cta_clicked   BOOLEAN DEFAULT FALSE,
  dismissed_at  TIMESTAMPTZ,
  shared        BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, moment_id, context)
);

CREATE INDEX idx_user_aha_moments_user_id ON user_aha_moments(user_id);

-- Add insight fields to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS runner_identity TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_timeline_weeks INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS projected_goal_date DATE;
```

---

## Moment #1 — "This knows me"

> *The app says something that feels personally true about the user's running identity.*

### Trigger Logic

**Fires after:** Onboarding completion — after all profile questions are answered, before the user enters the home tab. Falls back to after first run completion if onboarding is skipped.

**Required data:**

| Data Point | Source | Fallback |
|---|---|---|
| Running experience level | Onboarding Q | `'beginner'` |
| Primary goal | Onboarding Q | `'general fitness'` |
| Estimated current pace | Onboarding Q ("how fast do you run?") | `7:00/km` |
| Target event (optional) | Onboarding Q | `null` |

**Identity classification:**

| Identity | Conditions |
|---|---|
| `endurance_builder` | Pace >6:30/km AND goal is distance-based (5K, 10K, half, marathon) |
| `speed_seeker` | Pace <5:30/km OR goal is time-based (beat a PR) |
| `comeback_runner` | Experience = `'returning after break'` |
| `first_timer` | Experience = `'never run before'` |
| `balanced_athlete` | Everything else |

**Edge cases:**
- User skips all onboarding questions: show `'goal-oriented runner'` generic identity
- User misreports pace: identity silently updates after first real GPS run, does not re-fire the moment
- User has no goal: default to `'general_fitness'` identity path

**Fires:** Once. Never re-fires for the same user.

---

### UI/UX Design Spec

**Surface:** Full-screen overlay. Fires between the final onboarding screen and the home tab — it IS the transition.

**Visual treatment:**
- Dark background (brand dark, not pure black)
- Large centered identity badge: glyph + label (e.g., mountain + "Endurance Builder")
- Badge: scale-up + fade-in, 300ms ease-out
- Headline: appears 400ms after badge
- Subline: appears 600ms after badge
- CTA button: appears 800ms after badge
- Identity-specific accent color for badge ring:
  - `endurance_builder`: green
  - `speed_seeker`: orange
  - `comeback_runner`: purple
  - `first_timer`: blue
  - `balanced_athlete`: teal

**Layout:**
```
       [glyph]
   [identity label badge]    ← animated reveal

   [headline — 1 line]
   [subline — 2 lines max]

   [CTA button]
   [subtle: "Skip for now"]
```

**No auto-dismiss** — user must tap CTA or skip. This moment earns its permanence.

---

### Copy Examples

**Variant A — Motivational:**
> **You're a natural endurance runner.**
> Most people burn out chasing pace. You're built for the long game. We'll train around that.
> [Start my plan]

**Variant B — Data-driven:**
> **At your pace, you're in the endurance zone.**
> That's not a starting point — it's your advantage. Distance runners outlast speed runners every time.
> [See what that means]

**Variant C — Warm/human (control):**
> **We can already tell — you're in it for the miles, not the medals.**
> That's the kind of runner who surprises themselves. Let's find out how far.
> [I'm ready]

*(A/B test all three variants. See Testing section.)*

---

### Implementation Plan

**MVP:**
- Onboarding collects pace estimate + goal + experience level (already in onboarding flow)
- `UserInsightService.getRunningIdentity()` classifies on completion — pure function, no async
- `AhaMomentOverlay` renders identity badge + copy
- PostHog event fires on display; second event on CTA click
- Store identity in `profiles.runner_identity`

**Enhanced (post-MVP):**
- Identity updates silently after first real GPS run with actual pace data
- Identity visible as persistent "Runner Type" badge on profile screen
- Plan intro copy references identity label ("As an endurance builder, your plan focuses on...")

**Frontend:**
- New component: `RunnerIdentityMoment.tsx`
- Modify: `OnboardingFlow.tsx` — inject moment between final step and home navigation
- Shared: `AhaMomentOverlay.tsx` (new, reused by all 4 moments)

**Data/logic:**
- `UserInsightService.getRunningIdentity()` — synchronous lookup, no DB call at trigger time
- Write result to `profiles.runner_identity` via upsert
- Write `user_aha_moments` row for tracking

**Complexity:** Low

---

### Success Metrics

**PostHog events to log:**
- `aha_moment_fired` (moment_id: `'knows_me'`)
- `aha_moment_cta_clicked` (moment_id: `'knows_me'`)
- `aha_moment_dismissed` (moment_id: `'knows_me'`, time_to_dismiss_ms)

**Targets:**
- CTA click rate: >60%
- D1 return rate for users who see this moment: >40% (vs. baseline)

**North star:** Users who click CTA show 2x plan completion rate vs. users who dismiss.

**A/B test:** Variant A vs. B vs. C. Primary metric: CTA click rate. Roll out winner after 200 first sessions.

---

---

## Moment #2 — "I just did something I didn't think I could"

> *The app sets a micro-challenge the user completes and surprises themselves.*

### Trigger Logic

**Fires after:** First run completion (always). For subsequent runs, fires when a new personal best is achieved.

**Required data:**

| Data Point | Source | Fallback |
|---|---|---|
| Run distance (km) | GPS or manual entry | Required — do not fire without it |
| Previous best distance | `runs` table query | `null` on first run |
| Run duration | GPS or manual | Required |
| Run state (completed vs. stopped early) | Run state flag | Assume completed |

**Trigger conditions:**
1. First run ever: always fires, regardless of distance (showing up is the win)
2. Subsequent runs: fires if `current_distance_km > previous_best_distance_km`
3. Category milestones: fires on first run that crosses 5K, 10K, 21.1K thresholds, even if not overall best

**Edge cases:**
- User stops at <0.3km: moment fires with "you showed up" variant (distance not featured)
- User walks entire run: still fires (walking is running when you're starting)
- GPS failure, no distance recorded: do not fire; add to retry queue for next run
- User has prior run history (imported from Garmin/Strava): compare against imported history, not a blank slate
- Multiple conditions met (first run + category milestone): fire once with "first run" framing

**Fires:** Every qualifying new best. Not capped — recurring personal bests always deserve acknowledgment.

---

### UI/UX Design Spec

**Surface:** Post-run overlay. Fires before the user sees their stats — this moment IS the first thing they see after a run.

**Visual treatment:**
- Full-screen takeover on top of the post-run summary
- Large animated number counting up: from previous best to new best (or from 0 on first run)
- Counter animation: 1.2s duration, ease-out
- "New personal best" label beneath the number, fades in after counter completes
- Headline appears after counter + 200ms
- Subline appears after headline + 200ms
- Subtle particle effect: 4-6 small circles expand outward from the number (not confetti, not fireworks — restrained)
- Auto-dismisses after 4.5 seconds OR on any tap

**Layout:**
```
   [animated number — large]    ← e.g., "4.1 km"
   [label: "New personal best"]

   [headline — 1 line]
   [subline — 2 lines max]

   [tap anywhere to continue]   ← subtle hint text
   [share icon — bottom right]  ← optional action
```

**No explicit CTA button** — the moment itself is the celebration. Tapping anywhere is the natural exit.

---

### Copy Examples

**For first run:**

- **Variant A — Motivational:**
  > **Your first run. It had to start somewhere.**
  > It started today. Everything else builds from here.

- **Variant B — Data-driven:**
  > **Run 1 of many. You have a baseline now.**
  > 4.1 km. Your first data point. Let's see what we can do with it.

- **Variant C — Warm/human (control):**
  > **You showed up. That's the hardest part.**
  > It gets easier from here — but you'll always remember this one.

**For new personal best (subsequent runs):**

- **Variant A:**
  > **Your furthest run. Ever.**
  > You didn't know you'd go that far today. Now you do.

- **Variant B:**
  > **4.1 km — a new personal best.**
  > That's 400m more than you've ever run. Your body adapted. That's training working.

- **Variant C:**
  > **You just ran further than you ever have.**
  > We noticed. That wasn't on anyone's schedule — it just happened. Those are the runs that change things.

**For "you showed up" (very short run):**
  > **You started.**
  > That's not nothing. Most people didn't.

---

### Implementation Plan

**MVP:**
- Before posting new run to DB: query `SELECT MAX(distance_km) FROM runs WHERE user_id = $1`
- If `current > max` (or `max IS NULL`): queue Moment #2
- `AhaMomentOverlay` with `AnimatedCounter` component and achievement copy
- PostHog event on fire
- Write `user_aha_moments` row

**Enhanced (post-MVP):**
- Category milestone handling: first 5K, 10K, half marathon — distinct copy per milestone
- Share card: auto-generate shareable image (distance + achievement badge)
- Achievement stored in `user_achievements` table for badges/profile history
- Push notification variant: "You just ran your furthest 🎯" if user backgrounded the app

**Frontend:**
- New component: `AchievementMoment.tsx`
- New utility: `AnimatedCounter.tsx` (reusable number animation)
- Modify: `PostRunSummary.tsx` — check moment queue before rendering stats; render overlay first
- Shared: `AhaMomentOverlay.tsx`

**Data/logic:**
```typescript
const prevBest = await supabase
  .from('runs')
  .select('distance_km')
  .eq('user_id', userId)
  .neq('id', currentRunId)
  .order('distance_km', { ascending: false })
  .limit(1)
  .single();

const isNewBest = !prevBest.data || currentRun.distance_km > prevBest.data.distance_km;
```

**Complexity:** Low-medium (DB query + animation component)

---

### Success Metrics

**PostHog events to log:**
- `aha_moment_fired` (moment_id: `'achievement'`, is_first_run: bool, distance_km, improvement_km)
- `aha_moment_shared` (moment_id: `'achievement'`)
- `next_run_started` — track cohort: do users who saw this run again within 48h?

**Targets:**
- D2 run start rate for users who see this: >35% (vs. baseline ~15%)
- Share rate: >15% of users who see this tap share

**North star:** Users who experience Moment #2 have 3x D7 retention vs. users who don't.

**A/B test:** Animated counter vs. static stat display. Hypothesis: animation increases share rate. Minimum 300 runs per variant.

---

---

## Moment #3 — "I can see where I'm going"

> *The user gets a personalized plan and can visualize their future self.*

### Trigger Logic

**Fires after:** Goal-setting step of onboarding (when user selects a target race or goal). Falls back to after first run if goal-setting was skipped, or if user's goal is general fitness.

**Required data:**

| Data Point | Source | Fallback |
|---|---|---|
| Current pace estimate | Onboarding Q | `7:00/km` |
| Target goal distance | Onboarding selection | `'5K'` |
| Fitness level | Onboarding (`'beginner'` to `'advanced'`) | `'beginner'` |
| Race date (optional) | Onboarding Q | `null` (calculate from fitness) |

**Timeline calculation logic:**
- Use a simple lookup table based on `{ pace_bucket, fitness_level, target_distance }`
- Standard 10% weekly mileage increase (well-established running principle)
- Output: `weeks_to_goal` (minimum 4, maximum 24) + `milestone_week` (midpoint check-in)
- If user is already capable of target distance: redirect to time improvement goal

**Goal-to-timeline lookup (representative samples):**

| Goal | Fitness | Pace | Weeks |
|---|---|---|---|
| 5K | Beginner | >7:30/km | 8 |
| 5K | Intermediate | 6:00-7:30/km | 5 |
| 5K | Advanced | <6:00/km | 3 |
| 10K | Beginner | >7:30/km | 14 |
| Half Marathon | Beginner | any | 20 |
| Marathon | any | any | 24 |

**Edge cases:**
- No goal set: show habit goal ("In 4 weeks, you'll be running consistently 3x/week")
- Vague goal ("get fit"): show capability goal ("In 6 weeks, you'll feel a difference on your hardest climb")
- User already capable of target distance: pivot to PR goal ("You could run this week — here's how to get faster")
- Unrealistic timeline (marathon in 2 weeks): show honest projection ("A marathon takes 4-6 months — here's what that looks like")

**Fires:** Once. The timeline updates silently as weeks progress but the aha moment does not re-fire.

---

### UI/UX Design Spec

**Surface:** Dedicated "Your Path" screen — the final screen of the onboarding flow, before entering the app. Appears after Moment #1 (different scene, same session).

**Visual treatment:**
- Horizontal timeline: three dots connected by a line
  - Dot 1: "You today" — current state
  - Dot 2: Milestone (e.g., "First 3K" at week 3)
  - Dot 3: Goal (e.g., "5K ready") — accent color, slightly larger
- Animation: line draws left-to-right over 600ms, dots pulse on as line reaches them
- Goal dot uses the user's identity color from Moment #1 (continuity)
- Beneath goal dot: the projected date (e.g., "by Aug 3") or week count ("in 6 weeks") — A/B tested

**Layout:**
```
[headline — 1 line, largest text on screen]

   ●————————●————————●
  Today    Week 3    Week 6
 [now]  [milestone]  [goal]

[subline — 2 lines max]

[CTA: "Show me the plan"]       ← primary
[secondary: "Skip to app"]      ← subtle, below
```

**Visual style:**
- Clean and minimal — not a chart, a promise
- No number overload: only the key time estimate and two milestones
- The line itself communicates forward motion; it does not need labels everywhere

---

### Copy Examples

**For 5K goal, 6-week timeline:**

- **Variant A — Motivational:**
  > **Your first 5K is 6 weeks away.**
  > We built your plan around you. Three runs a week — that's all it takes.
  > [Show me the plan]

- **Variant B — Data-driven:**
  > **At your current pace, you're 6 weeks from 5K ready.**
  > Based on your fitness level and 3 runs per week, you'll be there by Aug 3.
  > [See the full plan]

- **Variant C — Warm/human (control):**
  > **Six weeks from now, you could be lining up at your first 5K.**
  > We don't know exactly how it goes — but we know you'll finish.
  > [Let's do this]

**For user already capable of goal:**
  > **You could run a 5K right now. So let's aim higher.**
  > In 6 weeks, you could take 4 minutes off your time. That's a different kind of goal.
  > [Upgrade my goal]

**For general fitness goal:**
  > **In 4 weeks, running 3 times a week will start to feel normal.**
  > That's when the habit locks in. Everything after that gets easier.
  > [Build my habit]

---

### Implementation Plan

**MVP:**
- `UserInsightService.projectGoalTimeline()` — synchronous lookup table, no async
- Static SVG timeline with 3 points, CSS animation for line draw
- Projected date = `today + weeks_to_goal * 7`
- CTA navigates to home tab (or to plan view if plan generator is active)
- Store `goal_timeline_weeks` and `projected_goal_date` in `profiles`

**Enhanced (post-MVP):**
- Live timeline: "Today" dot advances each week as plan progresses
- Week 3 push notification: "You're at your first milestone — halfway there"
- Race calendar: if user enters a real event date, calculate backwards to confirm feasibility
- If goal date becomes impossible: proactive "let's adjust" nudge

**Frontend:**
- New component: `GoalTimelineMoment.tsx`
- New utility: `TimelineGraphic.tsx` (SVG, reusable for plan progress elsewhere)
- Modify: `OnboardingFlow.tsx` — inject as penultimate screen before home

**Data/logic:**
```typescript
function projectGoalTimeline(
  paceKmPerMin: number,
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced',
  goalDistanceKm: number
): { weeks: number; milestoneWeek: number; projectedDate: Date }
```
- Lookup table stored as a typed constant (not DB query — deterministic)
- Write output to `profiles` on first call

**Complexity:** Medium (SVG animation + plan linkage)

---

### Success Metrics

**PostHog events to log:**
- `aha_moment_fired` (moment_id: `'future_vision'`, goal, weeks_to_goal)
- `aha_moment_cta_clicked` (moment_id: `'future_vision'`)
- `plan_viewed_from_moment` — does user open their plan from this CTA?

**Targets:**
- Plan open rate (CTA click): >55%
- D7 return rate for users who see this moment: >45%

**North star:** Users who click CTA here have 4x higher 4-week retention than users who dismiss.

**A/B test:** Specific date ("by Aug 3") vs. week count ("in 6 weeks"). Hypothesis: specific dates create stronger commitment. Primary metric: plan open rate.

---

---

## Moment #4 — "Someone noticed"

> *The app acknowledges something specific and human about what the user did.*

### Trigger Logic

**Fires after:** Any run completion. Evaluates context conditions in priority order. Fires the top-priority matching context.

**Context detection (priority order):**

| Priority | Context Key | Condition | Example label |
|---|---|---|---|
| 1 | `streak_N` | Consecutive days run: 3, 7, 14, 30, 60, 100 | "7-day streak" |
| 2 | `category_first` | First run crossing 5K, 10K, 21.1K | "First 10K" |
| 3 | `comeback` | First run after gap of 7+ days | "Back after a break" |
| 4 | `high_effort` | Pace >8% faster than 30-day rolling average | "Pushed harder" |
| 5 | `early_morning` | Run started before 6:30am | "Before sunrise" |
| 6 | `late_night` | Run started after 9:00pm | "Late night run" |
| 7 | `weather_rainy` | Weather API: precipitation detected | "Ran in the rain" |
| 8 | `weather_cold` | Weather API: temp <5°C | "Ran in the cold" |
| 9 | `weekend_only` | Weekend run when user's pattern is weekday-only | "Made it count" |
| 10 | `third_run_week` | 3rd run in a calendar week (non-streak) | "Building the habit" |

**Required data:**

| Data Point | Source | Fallback if missing |
|---|---|---|
| Current streak (consecutive days) | DB: runs ordered by date | Skip streak check |
| 30-day avg pace | DB: aggregate over recent runs | Skip high-effort check |
| Run start time | Device timestamp | Skip time-of-day checks |
| Days since last run | DB: most recent run before this one | Skip comeback check |
| Weather at run start | Weather API (async, non-blocking) | Skip weather checks |

**Edge cases:**
- Multiple contexts qualify: use highest priority only; lower contexts wait for future runs
- No context qualifies: moment does not fire (never force it)
- Same context threshold repeats: `streak_7` fires once at 7 days; `streak_14` fires once at 14 — not both
- Weather API unavailable or slow: skip weather contexts entirely, fall through to next priority
- 3-day minimum gap: even if a context qualifies, do not fire within 3 days of the last Moment #4

**Fires:** Repeatedly (up to once per 3 days, and always at streak milestones).

---

### UI/UX Design Spec

**Surface:** Inline card within the post-run summary screen, appearing between the stats section and the "Next Run" suggestion. NOT a full-screen overlay — this moment is quiet.

**Visual treatment:**
- Card with subtle left border (3px accent color, context-specific)
- Small icon representing the context (flame for streak, moon for late night, cloud for weather, lightning for effort)
- No animation — stillness is intentional; this moment is recognition, not celebration
- Text stays within 2 lines total (headline + subline)
- Optional share icon at bottom-right; never an explicit CTA button
- The card auto-dismisses when the user scrolls past (no action required)

**Layout:**
```
┌──────────────────────────────────────────────┐
│[icon]  [headline — bold, 1 line]              │
│         [subline — regular, 1-2 lines] [share]│
└──────────────────────────────────────────────┘
```

**Design intent:** This moment is a whisper, not a shout. It should feel like a thoughtful coach who noticed something, not an app celebrating you with confetti. The user should think "oh, it saw that" — not "here comes a notification."

---

### Copy Examples

**`streak_7` — 7-day streak:**
- **A (Motivational):** **"Seven days in a row."** Most people quit before this. You're past the hard part.
- **B (Data-driven):** **"7-day streak."** That's 7 consecutive days of choosing this. The habit is forming.
- **C (Warm/human):** **"Seven days straight."** The streak everyone talks about — the one you almost didn't start.

**`early_morning` — before 6:30am:**
- **A:** **"5:47am."** Most of your city is still asleep. You're already done.
- **B:** **"Early run: 5:47am."** Morning runners complete 40% more runs per week on average. Noted.
- **C:** **"You were running before sunrise."** We don't know why. We're glad you were.

**`comeback` — after 10-day gap:**
- **A:** **"You're back."** Gaps aren't failures. Getting back out is what matters.
- **B:** **"First run after 10 days."** The hardest run is always the one after a break. Done.
- **C:** **"Ten days off, and you came back."** That's harder than never stopping.

**`high_effort` — pace 12% above average:**
- **A:** **"You pushed today."** Your pace was 12% faster than usual. That's not nothing.
- **B:** **"Effort record: 12% above baseline."** Your hardest pace effort in 30 days.
- **C:** **"We noticed you ran harder than usual today."** So did your legs, probably. Good.

**`late_night` — after 9pm:**
- **A:** **"9:31pm run."** Most people watch TV. You ran.
- **B:** **"Late session: 9:31pm."** Evening runs count the same. You showed up.
- **C:** **"You ran tonight."** Whatever was in the way — you went anyway.

**`weather_rainy`:**
- **A:** **"You ran in the rain."** Not everyone would have.
- **B:** **"Wet conditions run logged."** Running in rain burns more effort. Worth noting.
- **C:** **"It was raining."** You went anyway. We saw that.

---

### Implementation Plan

**MVP:**
- Context detection runs synchronously after run is posted to DB
- Priority-based resolver: returns first matching `RunContext | null`
- Weather: async fetch from OpenWeatherMap using run start coordinates + timestamp (non-blocking)
- If context found: render `NoticedMoment` card in `PostRunSummary`
- PostHog event on fire

**Enhanced (post-MVP):**
- Streak push notification: fires at streak milestones even before user opens app
- Comeback push notification: fires at 7-day inactivity mark ("We noticed you've been away — no pressure")
- Historical moments log: "Moments" section in profile showing past noticed moments
- Per-context copy personalization: reference user's identity from Moment #1

**Frontend:**
- New component: `NoticedMoment.tsx` (card, not overlay — separate from `AhaMomentOverlay`)
- Modify: `PostRunSummary.tsx` — inject `NoticedMoment` after stats section if context found
- New service: `ContextDetector.ts` — pure function, no side effects, easily testable

**Data/logic:**
```typescript
async function detectRunContext(
  run: Run,
  userId: string,
  history: RunSummary[]
): Promise<RunContext | null> {
  // 1. Streak: count consecutive days ending today
  // 2. High effort: compare run.pace vs AVG(pace) of last 30 runs
  // 3. Time of day: from run.started_at
  // 4. Days since last run: from history[0].date
  // 5. Weather: await fetchWeather(run.started_at, run.start_lat, run.start_lng)
  // Return first match in priority order
}
```

Streak computation:
```sql
SELECT COUNT(*) as streak
FROM (
  SELECT DISTINCT DATE(started_at) as run_date
  FROM runs WHERE user_id = $1
  ORDER BY run_date DESC
) dates
WHERE run_date >= CURRENT_DATE - INTERVAL '1 day' * (streak_count - 1)
```

30-day avg pace:
```sql
SELECT AVG(pace_min_per_km) FROM runs
WHERE user_id = $1 AND started_at > NOW() - INTERVAL '30 days'
AND id != $current_run_id
```

**Complexity:** Medium (context detection + weather API integration)

---

### Success Metrics

**PostHog events to log:**
- `aha_moment_fired` (moment_id: `'noticed'`, context: `'streak_7'` | `'early_morning'` | etc.)
- `aha_moment_shared` (moment_id: `'noticed'`, context)
- Implicitly: absence of dismissal event = user read it and scrolled (positive signal)

**Targets:**
- Context detection hit rate: >40% of all runs trigger this moment
- Share rate: >20% for streak contexts, >10% overall
- D2 return rate for users who see this vs. those who don't: +20%

**North star:** Users who experience Moment #4 at least 3 times have 2x 30-day retention vs. users who experience it 0 times.

**A/B test:** Inline card (current spec) vs. full-screen overlay (same copy). Hypothesis: inline card feels more genuine and produces lower dismiss rate and higher share rate. Run after 500 runs per variant.

---

---

## A/B Testing Summary

| Moment | Test Question | Variants | Primary Metric | Min Sample |
|---|---|---|---|---|
| #1 "Knows Me" | Which copy tone drives most CTAs? | A (motivational) / B (data) / C (warm) | CTA click rate | 200 sessions |
| #2 "Achievement" | Does animation increase emotional impact? | Animated counter / Static stat | Share rate | 300 runs |
| #3 "Future Vision" | Specific date vs. week count for commitment? | "by Aug 3" / "in 6 weeks" | Plan open rate | 250 sessions |
| #4 "Noticed" | Overlay vs. card for recognition context? | Inline card / Full-screen overlay | Share rate + dismiss rate | 500 runs |

**Infrastructure:** Use PostHog feature flags (already integrated in RunSmart) for variant assignment. Assign at user creation; hold variant stable for the user's lifetime.

---

## Rollout Order

Rollout is deliberately phased from lowest-risk, no-run-data moments to higher-complexity post-run intelligence. Do not begin a later phase until the prior phase clears its quantitative gate.

| Phase | Moments | Rationale | Gate to next phase |
|---|---|---|---|
| Phase 1 | #1 + #3 | Fire during onboarding, require no run data, and validate the shared moment infrastructure with the lowest risk surface. | Proceed after 50 onboarding completions with #1 CTA rate >40% and #3 plan-open rate >45% |
| Phase 2 | #2 | Requires real run data and the post-run overlay. Build only after onboarding moments prove users respond to the system. | Proceed after 500 run completions with D2 run-start rate lifting >10% vs. pre-Phase-2 baseline |
| Phase 3 | #4 with weather API | Most complex: context detection, streak/comeback logic, time-of-day logic, and weather API checks. Build on stable Phase 2 post-run handling. | Proceed to broad rollout after context detection hits >35% of runs and weather lookup succeeds on >95% of eligible runs without blocking post-run render |

---

## Open Questions

1. **Weather API:** OpenWeatherMap free tier covers ~60 req/min. At scale, will need paid tier or caching by geohash + hour. Decide before Phase 3.
2. **Imported history:** When a user connects Garmin, Strava, or HealthKit, does imported history count for streak calculation and personal best comparison? Recommendation: yes, but flag it in the moment copy ("including your imported history").
3. **Moment #1 identity update:** After the first real GPS run, if the user's actual pace differs significantly from their onboarding estimate, should we re-show a revised identity moment? Recommendation: no re-fire, silent update to `profiles.runner_identity` only.
4. **Localization:** All copy is English-first. Moment #3's projected date ("by Aug 3") needs locale-aware date formatting before launching internationally.
5. **Dark mode:** All overlay and card components need dark mode variants from day one.
