# Agent Task Board

## Current Task
Implement Story 1 for the RunSmart Web Today page improvement.

## Exact Story
Story 1: Today Content Inventory and Preservation Map.

As a runner, I want all current Today functionality preserved so that the Today redesign does not lose useful data or actions.

## Goal
Create a small, safe, reviewable preservation map for the Today page before any redesign implementation. This story prepares the redesign by identifying current Today content/actions and assigning each item to Today, Plan, Profile, Run Report, or progressive detail.

## Expected Files To Change
- `tasks/todo.md`
- Likely `docs/specs/2026-05-12-today-command-center.md`
- Possibly a focused Today preservation/audit doc if needed after inspecting the relevant code.

## Validation Plan
- Inspect the smallest relevant Today code surface.
- Confirm all discovered Today content/actions are represented in the preservation map.
- Run documentation checks through review.
- Run app checks only if app source or tests are changed.

## Risks
- Missing a current Today item because the page is composed through nested components.
- Accidentally expanding scope into redesign work.
- Creating a map that is too vague to protect implementation.

## Will Not Change
- No database schema.
- No Garmin or Apple Health integrations.
- No paid services.
- No unrelated refactors.
- No removal of current functionality.
- No full Today redesign.

## Checklist
- [x] Read required Agent OS implementation files first.
- [x] Restate exact story.
- [x] List expected files to change.
- [x] Define validation plan.
- [x] Identify risks.
- [x] Confirm what will not change.
- [x] Inspect smallest relevant Today code surface.
- [x] Create/update the preservation map.
- [x] Validate map against discovered Today content/actions.
- [x] Run validation checks.
- [x] Update final progress and QA notes.

## Progress
Story 1 preservation map created in `docs/specs/2026-05-12-today-command-center.md` and validated. No app runtime code was changed.

## Open Questions
- The approved spec was not found as a saved `docs/specs/` file, so the prior planning package is being treated as the approved spec for this story.

## Validation
- Preservation map reviewed against `v0/components/today-screen.tsx` render composition and key Today subcomponents.
- `git diff --check`: passed.
- `npm run lint`: passed with existing warnings.
- `npm run type-check`: passed.
- `npm run test -- today-screen --run`: passed, 10 tests.
- `npm run build`: passed with existing warnings.

## Review Notes
- Keep this story preservation-first. Do not implement the full visual redesign.
- Story 2 should be the first visible UI/layout implementation story.
- Lesson added: save approved specs before implementation.
