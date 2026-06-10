# Work Packet — Aha Moments Phase 2 + Phase 3

**Goal:** Complete the RunSmart Aha Moment system by implementing Moment #2 (first-run / personal-best achievement overlay) and Moment #4 ("Someone noticed" — context-aware inline card), plus the shared DB persistence layer.

**Use `superpowers:subagent-driven-development` to execute this plan task-by-task.**

---

## What Phase 1 Already Built

These files exist and MUST NOT be reimplemented. Read them before writing anything new.

| File | What it does |
|------|-------------|
| `v0/lib/userInsightService.ts` | Pure functions: `getRunningIdentity()`, `projectGoalTimeline()` |
| `v0/components/aha-moment-overlay.tsx` | Reusable full-screen overlay shell (used by Moments #1 and #3) |
| `v0/components/runner-identity-moment.tsx` | Moment #1: identity badge shown after onboarding |
| `v0/components/goal-timeline-moment.tsx` | Moment #3: goal timeline shown after onboarding |
| `v0/components/onboarding-screen.tsx` | Wires Moments #1 and #3; intercepts `onComplete()` |
| `v0/lib/analytics.ts` | `trackOnboardingEvent()` — fire-and-forget PostHog wrapper |

**Pattern established by Phase 1:**
- Components receive pre-computed data as props — no async inside moment components
- PostHog events: `aha_moment_fired`, `aha_moment_cta_clicked`, `aha_moment_dismissed`
- Fire-and-forget analytics: `void trackEvent(...)` before navigation calls
- Tests use vitest + @testing-library/react; mock `@/lib/analytics` with `vi.mock`

---

## Rollout Order (from AHA_MOMENTS.md)

```
Phase 1 ✅  Moments #1 + #3  (onboarding, no run data required)
Phase 2 👈  Moment #2        (post-run achievement, requires run data)
            + DB persistence layer
Phase 3 👈  Moment #4        (context-aware inline card, recurring)
            + AhaMomentEngine orchestrator
```

**Gate:** Phase 3 builds on Phase 2. Complete and test Phase 2 fully before starting Phase 3.

---

## Existing Files to Read Before Modifying

| File | Why |
|------|-----|
| `v0/components/record-screen.tsx:2332` | `saveRun()` — where run is persisted; `finalizePostRunFlow(runId)` triggers navigation |
| `v0/components/record-screen.tsx:2558` | `finalizePostRunFlow()` — calls `navigateToRunReport(runId)` |
| `v0/app/runs/[id]/report/page.tsx` (or `v0/app/activities/[id]/page.tsx`) | Run report page — where Moment #4 card injects |
| `v0/lib/dbUtils.ts` | DB helper patterns — follow existing style for new helpers |
| `v0/components/insights/PostRunRecap.tsx` | Reference for how post-run data is consumed |

---

## Phase 2 — Moment #2 "I just did something I didn't think I could"

### Trigger logic

**Fires before** `finalizePostRunFlow(runId)` in `record-screen.tsx`.

Conditions (check in order; first true wins):
1. **First run ever** — `SELECT COUNT(*) FROM runs WHERE user_id = $1` returns 0 before the current run is inserted. Use `count` from `recordRunWithSideEffects` return value if available, or query after save.
2. **New personal best distance** — `current_distance_km > MAX(distance_km) FROM runs WHERE user_id = $1 AND id != $currentRunId`
3. **Milestone crossed** — first run ≥ 5.0 km, ≥ 10.0 km, or ≥ 21.1 km (check against prior run history)

If no condition is true: skip the moment, proceed directly to `finalizePostRunFlow`.

### New files

#### `v0/lib/achievementDetector.ts`

Pure async function — no side effects, easily testable.

```typescript
import { supabase } from '@/lib/supabase'

export type AchievementContext =
  | { type: 'first_run'; distanceKm: number }
  | { type: 'personal_best'; distanceKm: number; previousBestKm: number }
  | { type: 'milestone'; distanceKm: number; milestoneKm: 5 | 10 | 21.1 }

const MILESTONES: Array<5 | 10 | 21.1> = [5, 10, 21.1]

export async function detectAchievement(
  userId: string,
  currentRunId: number,
  currentDistanceKm: number
): Promise<AchievementContext | null> {
  const { data: prior } = await supabase
    .from('runs')
    .select('distance_km')
    .eq('user_id', userId)
    .neq('id', currentRunId)
    .order('distance_km', { ascending: false })
    .limit(1)
    .single()

  // First run
  if (!prior) {
    return { type: 'first_run', distanceKm: currentDistanceKm }
  }

  // Milestone
  for (const milestone of MILESTONES) {
    if (currentDistanceKm >= milestone && prior.distance_km < milestone) {
      return { type: 'milestone', distanceKm: currentDistanceKm, milestoneKm: milestone }
    }
  }

  // Personal best
  if (currentDistanceKm > prior.distance_km) {
    return {
      type: 'personal_best',
      distanceKm: currentDistanceKm,
      previousBestKm: prior.distance_km,
    }
  }

  return null
}
```

#### `v0/lib/achievementDetector.test.ts`

Mock `@/lib/supabase`. Test all 4 branches: first run, milestone, personal best, no achievement. At minimum:
- `first_run` when prior query returns null
- `milestone` when prior.distance_km = 4.5, current = 5.1 → returns `{ type: 'milestone', milestoneKm: 5 }`
- `personal_best` when prior.distance_km = 4.0, current = 4.5
- `null` when current < prior (no achievement)

#### `v0/components/animated-counter.tsx`

Reusable number animation. Use `requestAnimationFrame` — no external deps.

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  from: number
  to: number
  duration?: number  // ms, default 1200
  decimals?: number  // default 1
  suffix?: string    // e.g. " km"
}

export function AnimatedCounter({ from, to, duration = 1200, decimals = 1, suffix = '' }: AnimatedCounterProps) {
  const [value, setValue] = useState(from)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(from + (to - from) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [from, to, duration])

  return <>{value.toFixed(decimals)}{suffix}</>
}
```

#### `v0/components/achievement-moment.tsx`

Full-screen overlay. Auto-dismisses after 4500ms OR on any tap. Uses `AhaMomentOverlay` from Phase 1 as the underlying shell.

Copy variants — use Variant C (warm/human) as the shipped default for MVP:

| Scenario | headline | subline |
|----------|----------|---------|
| first_run | "You showed up." | "That's not nothing. Most people didn't." |
| first_run (≥1km) | "Your first run. It had to start somewhere." | "It started today. Everything else builds from here." |
| personal_best | "You just ran further than you ever have." | "We noticed. That wasn't on anyone's schedule — it just happened." |
| milestone 5K | "You crossed 5K." | "That distance means something. It always will." |
| milestone 10K | "You ran 10 kilometres." | "Most people talk about it. You just did it." |
| milestone 21.1K | "Half marathon distance." | "Every step from here is an encore." |

Show the animated counter only for `personal_best` and `milestone` types (not for `first_run`).

PostHog events:
- `aha_moment_fired` with `{ moment_id: 'achievement', achievement_type, distance_km, is_first_run }`
- No explicit CTA — tap anywhere to dismiss, which fires `aha_moment_dismissed`

#### `v0/components/achievement-moment.test.tsx`

At minimum 6 tests:
- Renders without error for `first_run` context
- Renders animated counter for `personal_best`
- `aha_moment_fired` event fires on mount
- `aha_moment_dismissed` event fires on tap
- Auto-dismiss via `vi.useFakeTimers()` + `vi.advanceTimersByTime(4500)`
- No CTA button present (achievement moment has no button)

### Wiring into `record-screen.tsx`

Read `saveRun()` carefully before editing. The injection point is after `recordRunWithSideEffects` returns successfully, before `finalizePostRunFlow`. Add:

```typescript
// State additions (near isGeneratingPlan state):
const [achievementContext, setAchievementContext] = useState<AchievementContext | null>(null)

// In saveRun(), after recordRunWithSideEffects() resolves:
try {
  const achievement = await detectAchievement(user.id, runId, distance)
  if (achievement) {
    setAchievementContext(achievement)
    return  // AchievementMoment will call finalizePostRunFlow via onDismiss
  }
} catch {
  // Non-critical — fall through to normal post-run flow
}
finalizePostRunFlow(runId)

// AchievementMoment render (at end of JSX, before closing tag):
{achievementContext && savedRunIdRef.current && (
  <AchievementMoment
    context={achievementContext}
    onDismiss={() => {
      setAchievementContext(null)
      finalizePostRunFlow(savedRunIdRef.current!)
    }}
  />
)}
```

Add `savedRunIdRef` to capture the runId for the closure (or pass it through state — follow whatever pattern is already in the file).

---

## DB Persistence Layer (needed by both phases)

### Migration

Create `supabase/migrations/YYYYMMDD_user_aha_moments.sql` (use today's timestamp):

```sql
CREATE TABLE IF NOT EXISTS user_aha_moments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users NOT NULL,
  moment_id     TEXT NOT NULL,
  context       TEXT,
  variant       TEXT,
  fired_at      TIMESTAMPTZ DEFAULT NOW(),
  cta_clicked   BOOLEAN DEFAULT FALSE,
  dismissed_at  TIMESTAMPTZ,
  shared        BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, moment_id, context)
);

CREATE INDEX IF NOT EXISTS idx_user_aha_moments_user_id ON user_aha_moments(user_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS runner_identity TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_timeline_weeks INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS projected_goal_date DATE;
```

DO NOT apply this migration automatically. Leave a note for the developer to run `supabase db push` or apply via the Supabase dashboard.

### DB helper

Add to `v0/lib/dbUtils.ts`:

```typescript
export async function recordAhaMoment(params: {
  userId: string
  momentId: 'knows_me' | 'achievement' | 'future_vision' | 'noticed'
  context?: string
  variant?: string
}) {
  const { error } = await supabase
    .from('user_aha_moments')
    .upsert(
      { user_id: params.userId, moment_id: params.momentId, context: params.context, variant: params.variant },
      { onConflict: 'user_id,moment_id,context', ignoreDuplicates: true }
    )
  if (error) console.warn('[recordAhaMoment] failed silently:', error.message)
}

export async function hasAhaMomentFired(userId: string, momentId: string, context?: string): Promise<boolean> {
  const query = supabase
    .from('user_aha_moments')
    .select('id')
    .eq('user_id', userId)
    .eq('moment_id', momentId)
  if (context) query.eq('context', context)
  const { data } = await query.limit(1).single()
  return !!data
}
```

---

## Phase 3 — Moment #4 "Someone noticed"

**Read Phase 2 code carefully before starting Phase 3.**

### Context detector

#### `v0/lib/contextDetector.ts`

Pure async function. Receives `run` and `userId`; queries history from Supabase. Returns first matching context in priority order, or `null`.

```typescript
import { supabase } from '@/lib/supabase'
import { hasAhaMomentFired } from '@/lib/dbUtils'

export type NoticeContext =
  | { type: 'streak'; days: 3 | 7 | 14 | 30 | 60 | 100 }
  | { type: 'comeback'; daysSince: number }
  | { type: 'high_effort'; percentAbove: number }
  | { type: 'early_morning'; startedAt: Date }
  | { type: 'late_night'; startedAt: Date }
  | { type: 'third_run_week' }

interface RunInput {
  id: number
  userId: string
  distanceKm: number
  durationSeconds: number
  startedAt: Date
  paceMinPerKm?: number
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const

export async function detectNoticeContext(run: RunInput): Promise<NoticeContext | null> {
  // 3-day cooldown check
  const { data: recent } = await supabase
    .from('user_aha_moments')
    .select('fired_at')
    .eq('user_id', run.userId)
    .eq('moment_id', 'noticed')
    .order('fired_at', { ascending: false })
    .limit(1)
    .single()

  if (recent?.fired_at) {
    const daysSinceLast = (Date.now() - new Date(recent.fired_at).getTime()) / 86400000
    if (daysSinceLast < 3) return null
  }

  // Streak check (priority 1)
  const { data: runDates } = await supabase
    .from('runs')
    .select('started_at')
    .eq('user_id', run.userId)
    .order('started_at', { ascending: false })
    .limit(110)

  const streak = computeStreak(runDates?.map(r => new Date(r.started_at)) ?? [])
  for (const milestone of [...STREAK_MILESTONES].reverse()) {
    if (streak === milestone) {
      const alreadyFired = await hasAhaMomentFired(run.userId, 'noticed', `streak_${milestone}`)
      if (!alreadyFired) return { type: 'streak', days: milestone }
    }
  }

  // Comeback check (priority 3)
  const { data: lastRun } = await supabase
    .from('runs')
    .select('started_at')
    .eq('user_id', run.userId)
    .neq('id', run.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (lastRun?.started_at) {
    const daysSinceLast = (Date.now() - new Date(lastRun.started_at).getTime()) / 86400000
    if (daysSinceLast >= 7) return { type: 'comeback', daysSince: Math.round(daysSinceLast) }
  }

  // High effort check (priority 4)
  if (run.paceMinPerKm) {
    const { data: avgData } = await supabase
      .from('runs')
      .select('pace_min_per_km')
      .eq('user_id', run.userId)
      .neq('id', run.id)
      .gte('started_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .not('pace_min_per_km', 'is', null)

    if (avgData && avgData.length >= 3) {
      const avg = avgData.reduce((sum, r) => sum + r.pace_min_per_km, 0) / avgData.length
      const improvement = (avg - run.paceMinPerKm) / avg
      if (improvement >= 0.08) return { type: 'high_effort', percentAbove: Math.round(improvement * 100) }
    }
  }

  // Time-of-day checks (priority 5 + 6)
  const hour = run.startedAt.getHours()
  const minute = run.startedAt.getMinutes()
  if (hour < 6 || (hour === 6 && minute === 0)) {
    return { type: 'early_morning', startedAt: run.startedAt }
  }
  if (hour >= 21) {
    return { type: 'late_night', startedAt: run.startedAt }
  }

  // Third run in week (priority 10)
  const weekStart = getWeekStart(run.startedAt)
  const { count } = await supabase
    .from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', run.userId)
    .gte('started_at', weekStart.toISOString())
    .neq('id', run.id)

  if ((count ?? 0) >= 2) return { type: 'third_run_week' }

  return null
}

function computeStreak(runDates: Date[]): number {
  const days = [...new Set(runDates.map(d => d.toISOString().slice(0, 10)))].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  let streak = 0
  let cursor = today
  for (const day of days) {
    if (day === cursor) {
      streak++
      const prev = new Date(cursor)
      prev.setDate(prev.getDate() - 1)
      cursor = prev.toISOString().slice(0, 10)
    } else if (day < cursor) {
      break
    }
  }
  return streak
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}
```

#### `v0/lib/contextDetector.test.ts`

Mock `@/lib/supabase` and `@/lib/dbUtils`. Test at minimum:
- Returns `null` when cooldown < 3 days
- Returns `{ type: 'streak', days: 7 }` when streak = 7 and not already fired
- Returns `{ type: 'comeback', daysSince: 10 }` when last run was 10 days ago
- Returns `{ type: 'high_effort', percentAbove: 12 }` when pace is 12% faster than avg
- Returns `{ type: 'early_morning' }` for a 5:47am run
- Returns `null` when no context matches

#### `v0/components/noticed-moment.tsx`

**NOT a full-screen overlay.** An inline card rendered within the run report page between the stats section and the "Next Run" suggestion. No animation — stillness is intentional.

Props:
```typescript
interface NoticedMomentProps {
  context: NoticeContext
  onShare?: () => void
}
```

Copy per context (Variant C — warm/human as default):

| context | headline | subline |
|---------|----------|---------|
| streak 3 | "Three days straight." | "The streak has started. This is how habits form." |
| streak 7 | "Seven days in a row." | "The streak everyone talks about — the one you almost didn't start." |
| streak 14 | "Two weeks straight." | "You've been at this for two weeks. It's becoming who you are." |
| streak 30 | "Thirty days." | "A month. Most people don't get here. You did." |
| comeback | "You're back." | "Gaps aren't failures. Getting back out is what matters." |
| high_effort | "You pushed today." | `You ran ${percentAbove}% faster than usual. That's not nothing.` |
| early_morning | `${formattedTime} run.` | "Most of your city is still asleep. You're already done." |
| late_night | `${formattedTime} run.` | "Whatever was in the way — you went anyway." |
| third_run_week | "Three runs this week." | "That's the habit. You're building it." |

Visual:
- `bg-card border-l-4` with accent color (green for streak/achievement, purple for comeback, orange for effort, slate for time-of-day)
- Icon from lucide-react: `Flame` (streak), `RotateCcw` (comeback), `Zap` (effort), `Sun` (morning), `Moon` (night), `Calendar` (third_run_week)
- Share icon (`Share2` from lucide-react) at bottom-right if `onShare` is provided

PostHog events:
- `aha_moment_fired` with `{ moment_id: 'noticed', context: context.type }`
- `aha_moment_shared` if user taps share

#### `v0/components/noticed-moment.test.tsx`

At minimum 5 tests:
- Renders correct headline for `streak` context
- Renders correct headline for `comeback` context
- `aha_moment_fired` fires on mount with correct context
- Share button calls `onShare`
- No share button when `onShare` is undefined

### Wiring Moment #4 into the run report

Find the run report page (likely `v0/app/runs/[id]/report/page.tsx` or `v0/app/activities/[id]/page.tsx`). Read it carefully.

After the run data loads:
1. Call `detectNoticeContext(run)` — async, non-blocking
2. If a context is returned, render `<NoticedMoment context={...} />` after the stats section
3. On successful render, call `recordAhaMoment({ userId, momentId: 'noticed', context: context.type })`

If `detectNoticeContext` throws, silently skip — never block the run report page.

---

## Testing All Phases

After completing all tasks, run:

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx vitest run \
  lib/achievementDetector.test.ts \
  lib/contextDetector.test.ts \
  components/achievement-moment.test.tsx \
  components/noticed-moment.test.tsx
```

All tests must pass. Then run the full test suite to check for regressions:

```bash
npx vitest run
```

---

## Constraints

- No new npm dependencies. `lucide-react` and `@testing-library/react` are already installed.
- Do not apply the Supabase migration — write the SQL file and add a comment: `-- Run via: supabase db push or Supabase dashboard`
- Weather API integration is Phase 3 enhanced (post-MVP) — skip it in this implementation
- All moment components must be error-safe: if detection throws, user never gets blocked
- Follow the fire-and-forget pattern for analytics: `void trackEvent(...)` before navigation

---

## Commit Convention

One commit per logical unit:
```
feat: add achievementDetector with first-run and personal-best detection
feat: add AnimatedCounter component
feat: add AchievementMoment component and tests
feat: wire AchievementMoment into record-screen post-run flow
feat: add user_aha_moments DB migration and recordAhaMoment helper
feat: add contextDetector with streak/effort/time-of-day detection
feat: add NoticedMoment inline card and tests
feat: wire NoticedMoment into run report page
```
