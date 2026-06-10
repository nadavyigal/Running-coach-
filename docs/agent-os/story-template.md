# Story Template

> Copy this template for each development story. Keep stories small — one story should be completable in a single focused session. Stories map to the Scrum Master role in `docs/agent-os/agent-roles.md`.

---

## Story: [Short Title — e.g., "Add HRV chart to Today Dashboard"]

**Epic:** [Epic number and name — e.g., Epic 3: Recovery Metrics]
**Story ID:** [e.g., 3.2.1]
**Complexity:** S / M / L
**Branch:** `feature/[story-id]-[slug]`
**Depends on:** [Story ID or "none"]

---

## User Value

> One sentence describing the value delivered to the end user (not the developer).

*Example: "Runners can see their HRV trend on the Today screen so they know whether to push or recover."*

---

## Technical Goal

> One sentence describing what changes in the codebase.

*Example: "Add an HRV sparkline component to TodayScreen that reads from Dexie HRVMeasurement table."*

---

## Files Likely Affected

> List every file expected to change. If you touch a file not listed here during implementation, stop and flag it.

- `v0/components/TodayScreen.tsx`
- `v0/components/HRVSparkline.tsx` (new)
- `v0/lib/dbUtils.ts` (add `getRecentHRV` utility)
- `v0/components/__tests__/HRVSparkline.test.tsx` (new)

---

## Acceptance Criteria

> Written as Given/When/Then. Must be testable.

- [ ] **Given** a user with ≥3 HRV measurements in Dexie, **when** the Today screen loads, **then** an HRV sparkline is visible showing the last 7 days.
- [ ] **Given** a user with 0 HRV measurements, **when** the Today screen loads, **then** the HRV section shows "No HRV data yet" placeholder (not a blank space or error).
- [ ] **Given** any state, **when** the Today screen loads, **then** there are no console errors.

---

## Test Plan

> List exact test cases, not just "write tests".

**Unit tests (`v0/components/__tests__/HRVSparkline.test.tsx`):**
- Renders sparkline when given mock HRV data array
- Renders placeholder when given empty array
- Snapshot test for visual regression

**Integration test (`v0/lib/__tests__/dbUtils.test.ts`):**
- `getRecentHRV(userId, 7)` returns correct records sorted by date

**Manual QA:**
- Open Today screen in dev. Verify sparkline renders with real Dexie data.
- Open Today screen with no HRV data. Verify placeholder text shows.

---

## QA Checks

- [ ] `npm run lint` passes from `v0/`
- [ ] `npm run type-check` passes (or pre-existing errors documented)
- [ ] `npm run test -- --run` passes
- [ ] No new console errors in browser DevTools
- [ ] Mobile layout correct at max-width `max-w-md`

---

## Rollback Considerations

> What breaks if this story is reverted?

- No DB schema changes — safe to revert by reverting the component file
- No new Supabase migrations — revert is clean

---

## Done Definition

This story is done when:
- All acceptance criteria pass
- All tests listed above pass
- QA checks are all green
- Code reviewer has signed off (see `docs/agent-os/review-checklist.md`)
- A summary comment is left in the PR describing what changed and what was tested
