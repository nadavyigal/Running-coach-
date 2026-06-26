# Plan-generator eval — baseline

First eval run that establishes where the plan-generator's AI output quality
starts. This is the "set the bar at the eval, not the demo" baseline. The gate
is intentionally left at the target (judge pass rate >= 0.85); the current
generator is below it. Do not loosen thresholds to make this green — fix the
generator.

## Baseline run (2026-06-26, generator gpt-4o / judge gpt-4o-mini)

- Cases: 12
- Judge pass rate: **0 / 12 (0%)** — target 0.85
- Fallback (AI generation failed, served deterministic plan): `advanced-marathon`, `high-volume-history`
- Safety-critical deterministic failures: `intermediate-half-marathon`, `mindful-challenge`, `speed-goal-5k`

## Findings (remediation backlog, highest signal first)

1. **Beginner/habit/mindful plans get hard sessions.** The generator adds
   tempo/interval/hill workouts to beginner, habit, masters, and mindful plans
   where `buildWorkoutMixConstraint` asks for "mostly easy." Flagged by the
   judge on 8+ cases and a hard `no-hard-sessions` failure on `mindful-challenge`.
   Likely fix: strengthen the prompt's intensity constraints and/or
   post-generation enforcement for low-intensity plan types.

2. **Long plans truncate at `maxOutputTokens: 1200`.** 12-week, 5-6 day plans
   exceed the token budget, the JSON is cut off, and production silently serves
   the generic fallback plan instead of personalized AI coaching. Likely fix:
   raise `maxOutputTokens` for long plans, or generate week-by-week.

3. **Aggressive load.** `speed-goal-5k` jumped volume 40% week-over-week (10%
   rule violation); `intermediate-half-marathon` peaked a 21km long run.
   Likely fix: add explicit weekly-progression caps to the prompt.

4. **Fallback plans are too plain for advanced runners.** When generation falls
   back, advanced runners get a monotonous easy/long plan. Secondary to fix #2.

Re-run with `npm run eval:plan` after each change and update this file.
