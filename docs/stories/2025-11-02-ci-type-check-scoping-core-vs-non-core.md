# Story: CI Type-Check Scoping (Core Strict, Non-Core Warn)

- Type: Architect / DevOps
- Goal: Keep CI green by enforcing strict type-checks on core paths, logging non-core errors as warnings until scheduled
- Links: `docs/implementation-reports/SPRINT_CHANGE_PROPOSAL_2025-11-02.md`

## Description
Adjust CI to run TypeScript checks in two tiers: core app paths must pass strictly; non-core/advanced routes are scanned and their errors reported as warnings (artifact), not failing the build.

## Acceptance Criteria
- CI job runs strict `tsc --noEmit` for core directories (app, components, lib core files)
- Non-core directories (e.g., experimental goals, devices, data-fusion, recovery advanced) are scanned and error summary is uploaded as an artifact or logged without failing
- Documentation added to `docs/` describing the scoping and plan to retire warnings

## Tasks
1) Identify core vs non-core directories and list in the story
2) Update CI workflow to run two-stage type-check
3) Add a markdown summary artifact for non-core errors
4) Document policy in `docs/` and link from README

## Risks / Notes
- Risk of masking new errors: add timeboxed limit (e.g., 30 days) and track backlog items

## Estimate
- 3 points

## Core vs Non-Core Directory Lists (proposed)

Core (must pass `tsc --noEmit`):
- `app/`
- `components/`
- `lib/` (exclude experimental or archived subfolders if any)
- `V0/components/` (onboarding + today UI)
- `V0/lib/` (Dexie utilities used by onboarding/today)

Non-Core (warn-only, summarized to artifact):
- `app/(experimental)/**`
- `app/devices/**`
- `app/recovery/**` (advanced only; exclude basic reset paths if core)
- `V0/experimental/**`
- `scripts/**` (if TS)
- `playground/**`

Note: Adjust exact paths to match repo; purpose is clear separation by MVP-critical flow vs advanced/backlog areas.

## CI Evidence Artifact
- File name: `docs/implementation-reports/ts-non-core-warnings-<run-id>.md`
- Contents:
  - Header with commit SHA and CI run URL
  - Grouped error summary by file path
  - Count totals and top offenders
  - Next-steps link to backlog items

## Implementation Outline (CI)
1) Core strict step
   - Run: `tsc -p tsconfig.json --noEmit` scoped to core include globs
2) Non-core warn step
   - Run: `tsc -p tsconfig.json --noEmit` scoped to non-core include globs
   - Capture exit code and transform into warning summary file (do not fail job)
   - Upload `ts-non-core-warnings-<run-id>.md` as artifact
3) Documentation
   - Add a short policy doc `docs/TYPECHECK_SCOPING_POLICY.md` and link from README

