# Feature Spec: Today Command Center Refresh

## Status
Approved for Story 1 implementation

## Date
2026-05-12

## Product Brief
Make the RunSmart Web Today page cleaner, more visual, less cluttered, and better aligned with a future native iOS direction while preserving current functionality. Today should act as the runner's daily command center.

## Summary
Today should clearly answer:
- What should I do today?
- Am I ready to train?
- What is my next workout?
- How am I progressing?
- What needs attention?
- What does the AI coach recommend?

The refresh should improve mobile-first visual hierarchy without removing data. Secondary or advanced data can move to better hierarchy or deeper pages, but it must remain accessible.

## Non-Goals
- Do not implement the full redesign in one step.
- Do not change database schema.
- Do not touch Garmin or Apple Health integrations.
- Do not introduce new paid services.
- Do not remove current functionality.
- Do not refactor unrelated areas.

## User Flow
1. Runner opens Today.
2. Runner sees the primary daily recommendation and current training state.
3. Runner checks readiness and next workout.
4. Runner reviews progress, attention items, and AI coach recommendation.
5. Runner drills into Plan, Profile, Recovery, or Run Report for deeper detail.

## Acceptance Criteria
- [ ] Today clearly shows the next best action.
- [ ] Readiness/training status is visible without hunting.
- [ ] Next workout is prominent and understandable.
- [ ] Progress is summarized visually, not as a wall of metrics.
- [ ] Attention items are grouped and actionable.
- [ ] AI coach recommendation is concise and practical.
- [ ] Existing Today data/actions remain accessible.
- [ ] Mobile viewport has no overlapping or cramped UI.

## Technical Approach
- Routes/components: `v0/app/today/page.tsx`, `v0/app/page-client.tsx`, `v0/components/today-screen.tsx`, and `v0/components/today/*`.
- API routes: no new API routes expected for the first layout stories.
- Data/Supabase: no schema changes expected.
- AI behavior: use existing coach guidance signals; do not change model/provider behavior in the first pass.
- Env/deployment: none expected.

## Current Today Preservation Map

This map is the no-loss contract for the redesign. Items may move, collapse, or link elsewhere, but they should not disappear without an explicit follow-up decision.

| Current item/action | Current source/component | Future owner | Preservation rule |
| --- | --- | --- | --- |
| RunSmart brand and reset onboarding action | `TodayScreen` header | Today / Profile settings later | Preserve reset action until an intentional account/settings move exists. |
| Weekly recap notification | `WeeklyRecapNotificationBanner` | Today | Keep near top when active because it is time-sensitive. |
| Create plan prompt for onboarded users without a plan | `TodayScreen` plan prompt card | Today and Plan | Preserve as a primary empty state that routes to Plan. |
| Daily focus hero, date, status, headline | `DailyFocusCard` | Today | Preserve as top command-center summary. |
| Primary action: Start Run / Sync Garmin / Log Recovery / Recovery Action | `DailyFocusCard` | Today | Preserve as the main CTA. |
| Secondary action: View Plan | `DailyFocusCard` | Today -> Plan | Preserve route to Plan. |
| Coach signal in hero | `DailyFocusCard` | Today | Preserve concise daily coach guidance. |
| Data quality banner: profile incomplete, sync issue, checking connection, partial data, device connected | `DataQualityBanner` | Today attention area | Preserve as an actionable attention item, but it can be visually grouped with other attention states. |
| Readiness metric | `KeyMetricsGrid` | Today | Preserve as readiness-to-train signal. |
| This week metric | `KeyMetricsGrid` | Today / Plan | Preserve summary on Today; deeper weekly context belongs on Plan or Insights. |
| Training load / consistency metric | `KeyMetricsGrid` | Today / Recovery or Insights | Preserve summary on Today; deeper diagnostics belong behind detail. |
| Coach confidence metric | `KeyMetricsGrid` | Today / Profile data quality | Preserve, but consider making it an attention/data-quality signal rather than a peer metric. |
| Weekly progress chart and plan completion | `ProgressSummaryChart` | Today / Plan | Preserve visual summary on Today; full plan progress belongs on Plan. |
| Plan updated timestamp | `TodayScreen` inline text | Today / Plan | Preserve as secondary context. |
| Coach insights: today focus, consistency trend, data coverage | `CoachInsightsPanel` | Today | Preserve, but consolidate with AI recommendation/attention hierarchy in future stories. |
| Active goal card | `TodayScreen` goal card | Today / Profile | Preserve compact goal summary on Today; full goal management belongs on Profile. |
| Active challenge progress and daily prompt | `ChallengeProgressRing`, `DailyChallengePrompt` | Today / Challenges | Preserve if active; avoid crowding the default state. |
| Today/next workout card | `TodayWorkoutCard` | Today / Plan | Preserve as core Today content. |
| Workout breakdown toggle and phases | `TodayWorkoutCard` | Today / Plan | Preserve behind progressive disclosure. |
| Route selection | `TodayWorkoutCard`, `RouteSelectorModal` | Today / Record | Preserve route selection action for planned runs. |
| Completed workout state | `TodayWorkoutCard` | Today / Run Report | Preserve completion state; deeper analysis belongs in Run Report. |
| Rest day state and unplanned run action | `TodayWorkoutCard` | Today / Record | Preserve rest guidance and unplanned run path. |
| Recent runs list and View run report action | `TodayScreen` recent runs card | Today / Run Report / Profile | Preserve latest run access; longer history belongs on Profile. |
| Add Run action | `TodayScreen`, `AddRunModal` | Today / Record | Preserve quick manual entry. |
| Activity action | `TodayScreen`, `AddActivityModal` | Today / Record/Profile | Preserve quick non-run activity entry. |
| Seven-day calendar strip | `TodayScreen`, `DateWorkoutModal` | Today / Plan | Preserve as a lightweight schedule preview; deeper calendar belongs on Plan. |
| Advanced analytics accordion | `AdvancedAnalyticsAccordion` | Today detail / Insights | Preserve as progressive detail, not primary content. |
| Weekly goal card | Advanced analytics | Today detail / Plan | Preserve in detail or move to Plan later. |
| Plan adjustment notice | Advanced analytics | Today attention / Plan | Preserve and consider surfacing only when actionable. |
| Insights panels dashboard | Advanced analytics | Insights / Today detail | Preserve access, but keep secondary. |
| Weekly recap widget | Advanced analytics widgets | Today detail / Insights | Preserve behind optional detail. |
| Refreshable coach tip | Advanced analytics widgets | Today / Coach detail | Preserve or merge with coach recommendation later. |
| Habit analytics widget | Advanced analytics widgets | Profile / Today detail | Preserve behind optional detail. |
| Goal recommendations | Advanced analytics widgets | Profile / Coach detail | Preserve behind optional detail. |
| Community stats widget | Advanced analytics widgets | Profile / Challenges | Preserve behind optional detail. |
| Sync status indicator and Sync Garmin action | Advanced analytics sync/account | Today attention / Profile integrations | Preserve, but do not change Garmin integration behavior. |
| Account active / sign out / sign up / log in | Advanced analytics sync/account | Profile / Account | Preserve until moved intentionally to Profile/account area. |
| Morning check-in modal | `MorningCheckInModal` | Today / Recovery | Preserve readiness input path. |
| Add run/activity/route/reschedule/date workout modals | Today modal stack | Today / related flows | Preserve modal access and callbacks. |
| Reset and remove workout confirmation dialogs | Today dialog stack | Today / Plan | Preserve destructive confirmations. |

## Proposed Information Architecture

### Keep Primary on Today
- Daily focus and next best action.
- Readiness to train.
- Today's or next workout.
- Actionable attention states.
- Compact progress snapshot.
- Concise AI coach recommendation.
- Quick add/run actions.

### Keep as Today Detail or Progressive Disclosure
- Advanced analytics.
- Data coverage and coach confidence details.
- Weekly recap widget.
- Coach tip refresh.
- Habit, goal recommendation, and community widgets.
- Sync/account cards until a dedicated Profile/settings destination is implemented.

### Move Toward Plan Ownership
- Full plan calendar.
- Weekly structure and plan adjustments.
- Deeper plan completion analysis.
- Date workout details beyond the lightweight Today strip.

### Move Toward Profile Ownership
- Account state, sign out, sign up/log in.
- Long-term goals and preferences.
- Shoes, settings, integrations, and historical run list.
- Habit and community profile context.

### Move Toward Run Report Ownership
- Completed run details.
- Recent run deep links.
- Pace, route, splits, effort, and post-run coach recap.

## Development Stories

### Story 1: Today Content Inventory and Preservation Map
**Status:** Implemented in this spec.

**As a** runner
**I want** all current Today functionality preserved
**So that** the redesign does not lose useful data or actions.

**Acceptance Criteria**
- [x] Current Today content/actions are inventoried from the relevant Today code surface.
- [x] Each item has a future owner.
- [x] Each item has a preservation rule.
- [x] No app behavior, schema, Garmin, Apple Health, or paid service changes are made.

### Story 2: Daily Command Center Layout
Create the new mobile-first Today hierarchy: primary action, readiness, next workout, progress, attention, coach.

### Story 3: Visual Progress and Attention Sections
Replace dense metric presentation with compact visual summaries and actionable attention items.

### Story 4: Progressive Disclosure for Secondary Data
Move less-daily or advanced information behind expandable/detail affordances or links to better pages.

### Story 5: Mobile QA and Regression Pass
Validate responsive behavior, preserved functionality, and no Today/Plan/Profile/Run Report regressions.

## Validation Plan
- Automated: no app tests required for Story 1 because only documentation/task memory changed.
- Manual: review preservation map against `TodayScreen` composition and Today subcomponents.
- Mobile: required starting with Story 2 because visible UI will change.
- Supabase: not touched.
- Vercel: not touched.

## Rollout / Rollback
- Rollout: use this spec as the implementation contract for later stories.
- Rollback: revert this spec and `tasks/todo.md` updates; no app runtime behavior is affected.

## Open Questions
- Should account/sync cards move to Profile in the same redesign phase, or remain in Today detail until Profile is prepared?
- Should coach confidence be a visible metric or folded into data-quality/attention messaging?
- Should challenge/community content stay on Today by default, or appear only when there is an active daily action?
