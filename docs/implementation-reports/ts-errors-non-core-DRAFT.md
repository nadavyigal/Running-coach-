# Non-Core TS Errors – DRAFT (target: app/devices)
Date: 2025-11-02

Status: Draft placeholder. Run local type-check to populate.

Recent actions (app/api/devices):
- Added `export const runtime = 'nodejs'` to Garmin routes to ensure Node APIs (e.g., Buffer) are typed/available.
- Guarded optional settings access and used nullish-coalescing for spreads in settings objects.
- Normalized `userId` to number in device connect route.
- Awaiting `tsc --noEmit` output to populate file-level counts.

## How to Populate
1) Ensure dev env is up
2) Run TypeScript checks
   - Core strict: tsc --noEmit (core globs)
   - Non-core target (app/devices): tsc --noEmit (app/devices globs)
3) Paste grouped errors below

## Groups
### app/devices
- Files: (populate after run)
- Errors: (count)
- Issue: link to created story/PR

## Totals
- Errors: (count)
- Files affected: (count)


