# RunSmart Product Strategy Design

Date: 2026-02-12
Owner: Nadav + Codex
Status: Validated in brainstorming session

## Context and Inputs
- GTM/# RunSmart Market Entry & Growth St.txt
- GTM/SmartRun Competitive Analysis & Imp.txt
- GTM/Overview of AI-Adaptive Running Coa.txt
- GTM/benchmark.xlsx
- GTM/improvement suggestens.txt
- Product brief and PRD in repo root

## Strategy Summary
RunSmart will win a defensible niche by delivering an AI running coach that adapts to how users feel, not just what their devices say. We will serve two segments with one unified message and an adaptive experience: phone-only runners (primary) and watch users seeking an AI layer (secondary). The near-term strategy prioritizes habit formation and perceived personalization through a dual first-session aha (recovery insight + personalized coach), while keeping device integration scoped to one bi-directional ecosystem (Garmin) to satisfy serious runners without diluting execution.

## Decisions Locked
- Positioning: "The AI coach that adapts to how you feel."
- Unified messaging with adaptive personalization (no explicit mode switching).
- Dual first-session aha: recovery insight + coach personalization.
- Phone-only input: ultra-light daily check-in (sleep hours + overall feeling).
- Focus split: 70% phone-only / 30% watch for next 6-8 weeks.
- First device ecosystem: Garmin bi-directional sync.
- Monetization: free core + Pro add-ons.
- Primary proof point: D30 retention >= 25%.

## Audience Segments
- Phone-only runners (primary): casual runners who want coaching without buying a watch.
- Watch users (secondary): Garmin/Apple Watch owners who want an AI layer on top of existing tracking.

## Messaging Architecture
- One brand story across all channels.
- Personalization prompt in onboarding: "Do you run with a watch?" (No / Yes / Sometimes).
- In-product adapts silently:
  - Phone-only: emphasizes quick check-ins, recovery insight, and confidence transparency.
  - Watch users: emphasizes device sync and improved confidence in recommendations.

## First-Session Aha
Goal: user experiences immediate value without heavy setup.
- Aha 1: recovery insight based on ultra-light inputs.
- Aha 2: coach reflects a personal preference (tone, schedule, detail level).

## Product Pillars
1. Feel-first intelligence: adaptation guided by subjective inputs + training history.
2. Visible coaching: make personalization and learning explicit to users.
3. Plan -> Execute -> Reflect -> Adapt loop: consistent daily rhythm that builds habit.

## Data and Coaching Loop
- Sense: sleep hours + overall feeling, post-run RPE, run history.
- Decide: confidence-weighted recovery and plan adjustment.
- Coach: daily message that reflects user preferences.
- Adapt: light plan changes based on completion and effort.

## 6-8 Week Strategy and Priorities
Phone-only lane (70%):
- Recovery insight as hero metric on Today screen.
- Ultra-light check-in embedded in daily flow.
- Post-run RPE capture.
- Coach personalization indicator.
- Weekly goal + streak widget.

Watch lane (30%):
- Garmin bi-directional sync (push workouts, pull completed runs).
- Sync success feedback and confidence boost messaging.

## Device Integration Strategy
- Target Garmin first due to serious-runner adoption and clear value of structured workouts.
- Keep scope tight until Garmin stability and adoption are proven.

## Monetization Strategy
- Free core: GPS recording, basic plans, recovery insight, limited AI coaching.
- Pro add-ons: advanced recovery trends, unlimited AI, device sync, audio coaching.

## Metrics and Validation
Primary:
- D30 retention >= 25%.

Supporting (phone-only):
- Daily check-in completion >= 40%.
- Post-run RPE capture >= 60% of logged runs.
- Weekly plan completion >= 55% among actives.
- Coach personalization seen >= 50%.

Supporting (watch):
- Garmin sync activation >= 30% of users who indicate a watch.
- Workout push success >= 95%.
- Imported run usage >= 60% among connected users.

Qualitative:
- AI coach rating >= 4/5.
- "Understands how I feel" sentiment in feedback.

## Risks and Mitigations
- Coaching feels too light for phone-only users.
  - Mitigation: confidence transparency, post-run RPE, "what changed" messaging.
- Garmin sync setup friction.
  - Mitigation: immediate value (push one workout), minimal setup steps.
- Coach feels generic.
  - Mitigation: explicit preference capture + visible personalization indicators.
- Split focus dilutes execution.
  - Mitigation: enforce 70/30 allocation and review weekly.
- Metrics do not move.
  - Mitigation: weekly cohort reviews and rapid onboarding iteration.

## Assumptions
- PWA-first approach remains for next 60-90 days.
- Phone-only recording already supported via always-on screen behavior.
- Garmin developer access will be available within the next sprint.

## Next Steps
- Translate this strategy into a 2-week execution plan and backlog.
- Align analytics events with metrics above.
- Prepare a short product narrative for landing/onboarding copy.
