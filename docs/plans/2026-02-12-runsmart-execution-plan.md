# RunSmart Execution Plan (Codex-Ready)

Date: 2026-02-12
Owner: Nadav + Codex
Purpose: 6-8 week execution plan aligned to the product strategy.

## Goals
- Ship the dual-aha first-session experience: recovery insight plus visible coach personalization.
- Make the phone-only experience habit-forming with minimal daily input.
- Deliver Garmin bi-directional sync as the first serious-runner unlock.
- Hit D30 retention >= 25% and establish a measurable coaching loop.

## Scope Boundaries
- In scope: phone-only coaching loop, recovery surface, coach personalization, post-run RPE, weekly goals and streaks, Garmin bi-directional sync.
- Out of scope: full native app, multi-device sync beyond Garmin, social features beyond light sharing, heavy redesign.

## Success Metrics
- D30 retention >= 25%.
- Daily check-in completion >= 40%.
- Post-run RPE capture >= 60% of logged runs.
- Weekly plan completion >= 55% among active users.
- Garmin sync activation >= 30% of users who indicate a watch.
- Workout push success >= 95%.

## Workstreams
1. Product and UX: onboarding prompts, recovery hero, coach personalization indicator, weekly goals and streaks.
2. Core engineering: plan adaptation hooks, RPE capture, data model updates, analytics.
3. Device integration: Garmin bi-directional sync (push workouts, pull completed runs).
4. GTM enablement: positioning copy, onboarding copy, landing headline, proof points.

## Execution Timeline (6-8 Weeks)

### Weeks 1-2: Dual Aha and Daily Loop Foundation
- Add ultra-light daily check-in with two fields: sleep hours and overall feeling.
- Surface recovery insight on Today screen as the primary metric.
- Add coach personalization indicator on Today or Profile.
- Add post-run RPE capture and store in run record.
- Instrument analytics for check-in, recovery view, and RPE submission.

Deliverables
- Recovery hero card wired to real data.
- Check-in flow in daily experience.
- Coach personalization indicator.
- RPE prompt on run completion.

### Weeks 3-4: Habit Reinforcement
- Implement weekly goal selection and progress tracking.
- Add streak widget for consecutive weeks with >= X runs.
- Add weekly recap surface in-app.
- Tune plan adaptation to incorporate RPE and check-in signals.

Deliverables
- Weekly goal widget.
- Streak widget with definition and reset rules.
- Weekly recap banner.
- Light plan adaptation based on new signals.

### Weeks 5-6: Garmin Bi-Directional Sync
- Implement Garmin workout push for structured plans.
- Implement activity pull to import completed runs.
- Add device connection flow and sync status feedback.
- Add analytics for sync activation and push success.

Deliverables
- Garmin connect flow and settings surface.
- Workout push endpoint and job.
- Activity pull endpoint and import mapping.
- Sync success and failure states.

### Weeks 7-8: Stabilization and Optimization
- Fix top friction points from analytics and user feedback.
- Optimize onboarding messaging for phone-only and watch users.
- Tighten analytics dashboards and retention tracking.
- Prepare a v1 product narrative and launch checklist.

Deliverables
- Stability fixes.
- Updated onboarding copy.
- Metrics dashboard snapshot.
- Launch checklist and KPI review.

## Engineering Checklist (Codex-Ready)

### Phone-Only Coaching Loop
- Add daily check-in model and storage.
- Wire recovery computation to new inputs.
- Surface recovery on Today screen.
- Add post-run RPE capture and persist.
- Update plan adaptation logic to use RPE and recovery.

### Personalization Visibility
- Add a visible indicator that the coach learned a preference.
- Ensure the coach message references a user preference.

### Habit Mechanics
- Implement weekly goal target (runs per week).
- Track weekly completion and streak.
- Show streak and weekly goal progress on Today screen.
- Add weekly recap banner.

### Garmin Integration
- Implement workout push mapping from plan to Garmin format.
- Implement activity pull and mapping to local run model.
- Add device connection UI and sync status.

### Analytics
- Define and emit events for: check-in submitted, recovery viewed, RPE submitted, weekly goal set, streak updated, Garmin sync connected, workout push success, workout push failed, activity imported.
- Add a weekly cohort retention report.

## Dependencies
- Garmin developer access and API credentials.
- Existing plan generator and run storage tables.
- Recovery engine and coaching profile data stores.

## Risks and Mitigations
- Garmin API delays: ship phone-only features first and keep Garmin scope tight.
- Coach feels generic: force early preference capture and reflect it in coach messages.
- Check-in fatigue: keep it two fields and embed in daily flow.

## Definition of Done
- D30 retention tracking is live and reviewed weekly.
- Phone-only loop is complete: check-in, recovery, RPE, plan adaptation.
- Weekly goals and streaks are shipped with analytics.
- Garmin bi-directional sync is usable by beta testers.
- Onboarding and messaging aligned with unified positioning.

## Handoff Notes for Codex Session
- Use this plan as the backlog and execution order.
- Prefer small, incremental PRs per workstream.
- Confirm event names and data model changes before implementation.
- Start with Weeks 1-2 tasks, then move in order.
