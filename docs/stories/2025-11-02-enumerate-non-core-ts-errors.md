# Story: Enumerate Non-Core TypeScript Errors and Backlogize

- Type: PM / Dev
- Goal: Produce a categorized list of non-core TS errors and create backlog items grouped by epic/feature
- Links: `docs/implementation-reports/SPRINT_CHANGE_PROPOSAL_2025-11-02.md`

## Description
Run type-checks across non-core areas, capture errors, categorize by route/module, and create backlog items with priority and estimates.

## Acceptance Criteria
- A markdown report exists under `docs/implementation-reports/` listing non-core TS errors grouped by directory/feature
- Report filename follows: `docs/implementation-reports/ts-errors-non-core-<commit-sha>.md`
- Each group maps to a backlog item with title, scope, labels, and estimate
- No change to dev flow; CI scoping story handles gating

## Tasks
1) Run type-check and capture output
   - Command (local): `npm run type-check` (or `tsc --noEmit`)
2) Filter to non-core paths; group by feature (goals, devices, data-fusion, recovery, etc.)
3) Produce report `docs/implementation-reports/ts-errors-non-core-<commit-sha>.md`
   - Include: commit SHA, timestamp, totals, grouped sections, top offenders
4) Create backlog issues (one per group)
   - Title: `Fix TS errors – <feature-group>`
   - Labels: `area:<group>`, `tech:ts`, `non-core`, `debt`
   - Content: scope summary, file list, error count, estimate
5) Link issues back in the report; propose priorities (MVP-needed vs Future)
6) Add a short link section to `docs/TYPECHECK_SCOPING_POLICY.md` (if exists)

## Risks / Notes
- Counts vary by branch; lock report to current commit SHA
 - Non-core paths defined by CI scoping story; align grouping accordingly

## Report Template
```
# Non-Core TS Errors – <commit-sha>
Date: <iso>

Totals: <count> errors across <files>

## Groups
### <group-name>
- Files: <list>
- Errors: <count>
- Issue: <tracker-link or TBD>

<paste tsc excerpts or summarized bullets>
```

## Suggested Next Step (Agent + Task)
- Agent: `pm`
- Command: `*task brownfield-create-epic "Fix non-core TS errors – <top-group>"`
  - If scope is small, use: `*task brownfield-create-story "Fix TS errors – <top-group>"`

## Links
- Epic: `docs/backlog/epic-fix-non-core-ts-errors-TOP_GROUP.md`

## Estimate
- 2 points

