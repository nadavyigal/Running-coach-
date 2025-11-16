# Story: Fix TS errors – app/api/devices

- Type: Dev / Maintenance
- Goal: Reduce noise by fixing the highest-impact non-core TypeScript error group (app/api/devices) without impacting core MVP flows
- Links: `docs/backlog/epic-fix-non-core-ts-errors-TOP_GROUP.md`, `docs/stories/2025-11-02-enumerate-non-core-ts-errors.md`, `docs/stories/2025-11-02-ci-type-check-scoping-core-vs-non-core.md`

## Description
Apply minimal, localized fixes to eliminate TypeScript errors in app/api/devices. Do not alter core app behavior. Keep changes confined to the target group to avoid cross-cutting effects.

## Acceptance Criteria
- All files in app/api/devices build type-clean (0 TS errors)
- Core paths remain unaffected (no new errors; app builds)
- CI non-core warning artifact shows 0 errors for app/api/devices
- Report updated with resolution notes and file list

## Tasks
1) Identify current error files for app/api/devices from the latest enumeration report
2) Apply minimal TS fixes (types, guards, narrow casting, remove dead code where safe)
3) Validate locally: `tsc --noEmit` for core + app/api/devices and full build
4) Update non-core TS report marking app/api/devices as resolved
5) Open PR with clear scope and link to epic + report

## Constraints
- No dependency changes or installs
- No API contract changes
- Keep fixes scoped to app/api/devices; avoid core directories

## Steps (suggested)
1) Parse `docs/implementation-reports/ts-errors-non-core-<commit-sha>.md` to extract app/api/devices file paths
2) Fix errors incrementally; re-run `tsc --noEmit` after each batch
3) Run dev build locally to ensure no regressions
4) Update the report with a "Resolved app/api/devices" section (files and brief notes)
5) Commit and open a PR referencing the epic

## Definition of Done
- [ ] 0 TS errors in app/api/devices
- [ ] Core paths remain type-clean
- [ ] CI non-core artifact highlights 0 errors for app/api/devices
- [ ] Report updated and PR linked

## Risks / Mitigations
- Risk: Changes accidentally touch shared types → Mitigation: isolate changes, prefer local type defs or guards
- Risk: Hidden runtime behavior change → Mitigation: smoke test affected routes/components

## Estimate
- 2 points

---

## Dev Agent Record

### Tasks / Subtasks Checkboxes
- [ ] Identify current error files for app/devices from enumeration report
- [ ] Apply minimal TS fixes in app/devices
- [ ] Validate: `tsc --noEmit` (core + app/devices) and full build
- [ ] Update non-core TS report marking app/devices resolved
- [ ] Open PR linked to epic and report

### Agent Model Used
- dev

### Debug Log References
- Pending: run local type-check to capture error list for app/devices

### Completion Notes
- Pending execution; scoped plan prepared

### File List
- No source files modified yet (prep phase)

### Change Log
- 2025-11-02: Added Dev Agent Record and execution checklist (prep)

### Status
- In Progress (awaiting type-check run to enumerate concrete files)

