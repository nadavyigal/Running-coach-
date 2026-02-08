---
name: growth-analytics
description: >
  Analytics setup, conversion tracking, growth metrics, and data-driven optimization
  for RunSmart. Covers event tracking, funnel analysis, cohort metrics, retention
  curves, and experiment frameworks. Use when setting up analytics, analyzing user
  behavior, or designing growth experiments.
metadata:
  short-description: Track, measure, and optimize RunSmart growth with analytics and experiments.
---

## When Claude should use this skill
- Setting up analytics tracking for new features
- Analyzing user funnels (onboarding → plan → run → retention)
- Designing A/B tests or growth experiments
- Creating dashboards or metric reports
- User asks "how are we doing" or "what should we measure"

## Core Metrics (North Star Framework)

### North Star Metric
**Weekly Active Runners** — users who complete at least 1 tracked run per week.

### Input Metrics
| Metric | Definition | Target |
|--------|-----------|--------|
| Onboarding completion | % of new users who finish onboarding | 70% |
| Plan generation rate | % of onboarded users who generate a plan | 60% |
| First run rate | % of plan holders who record first run | 50% |
| Weekly retention (W1) | % returning in week 1 | 40% |
| Monthly retention (M1) | % returning in month 1 | 25% |

### Revenue Metrics (Future)
| Metric | Definition | Target |
|--------|-----------|--------|
| Free → Premium conversion | % upgrading to paid tier | 5% |
| ARPU | Average revenue per user | $3/month |
| LTV | Lifetime value | $36 |
| CAC | Customer acquisition cost | < $5 |

## Event Tracking Schema
```typescript
// Core events to track
interface AnalyticsEvent {
  event: string;
  properties: Record<string, string | number | boolean>;
  timestamp: Date;
  userId?: number;
  sessionId: string;
}

// Key events
const EVENTS = {
  // Onboarding
  'onboarding_started': {},
  'onboarding_step_completed': { step: number, stepName: string },
  'onboarding_completed': { goal: string, experience: string },

  // Plans
  'plan_generated': { planDuration: number, sessionCount: number },
  'plan_viewed': {},
  'workout_viewed': { sessionType: string },

  // Runs
  'run_started': {},
  'run_completed': { distanceKm: number, durationMin: number, avgPace: string },
  'run_abandoned': { reason: string },

  // AI
  'chat_message_sent': {},
  'ai_response_received': { latencyMs: number },

  // Engagement
  'app_opened': { source: 'pwa' | 'browser' },
  'screen_viewed': { screen: string },
  'notification_clicked': { type: string },

  // Growth
  'share_initiated': { channel: string },
  'referral_sent': {},
  'review_prompted': {},
};
```

## Funnel Analysis

### Activation Funnel
```
Visit landing page
  → Install PWA / Sign up
    → Complete onboarding
      → Generate first plan
        → Complete first run
          → Return in week 2
```

### Engagement Loop
```
Open app → View today's workout → Record run → See insights →
Get next workout → (repeat)
```

## Growth Experiment Framework

### Experiment Template
```markdown
## Experiment: [Name]
**Hypothesis:** If we [change], then [metric] will [improve/increase] by [X%]
**Metric:** [Primary metric to move]
**Audience:** [Who sees this]
**Duration:** [How long to run]
**Success criteria:** [Statistical significance threshold]
**Implementation:** [What to build]
**Rollback plan:** [How to revert]
```

### High-Impact Experiment Ideas for RunSmart
1. **Social proof on landing**: Show "X runners trained this week"
2. **Simplified onboarding**: 3 questions vs 7 questions
3. **Push notification timing**: Morning of workout day vs evening before
4. **AI coach personality**: Encouraging vs data-driven tone
5. **Streak mechanics**: Daily streak badge vs weekly consistency score

## Retention Strategies
- **Day 1**: Welcome push notification with first workout
- **Day 3**: "How was your first run?" prompt
- **Day 7**: Weekly summary with progress visualization
- **Day 14**: Plan check-in, offer adjustment
- **Day 30**: Achievement badge, share prompt
- **Lapsed**: Re-engagement email with updated plan offer

## Agent Team Pattern: Analytics Sprint
```
Create an agent team for analytics setup:
- Tracking teammate: implement event tracking in codebase
- Dashboard teammate: design metric queries and visualization
- Experiment teammate: set up A/B test infrastructure
Lead synthesizes into analytics implementation plan.
```

## Integration Points
- Events: Custom analytics module in `V0/lib/analytics.ts`
- Storage: IndexedDB for local event buffer
- Reporting: Vercel Analytics, custom dashboard
- A/B tests: Feature flags in app config
