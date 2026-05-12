# QA Checklist

Use this checklist before marking app work done. Scope checks to the files and flows changed.

## Automated Checks
- [ ] `npm run lint` from `v0/`.
- [ ] `npm run type-check` from `v0/`.
- [ ] Relevant `npm run test -- --run ...` from `v0/`.
- [ ] `npm run build` from `v0/` when deployment risk exists.
- [ ] `npm run test:e2e` or focused Playwright spec when route-level behavior changes.

## Manual Smoke Checks
- [ ] App loads locally.
- [ ] Main changed route loads without console errors.
- [ ] Mobile viewport is usable.
- [ ] Loading and empty states make sense.
- [ ] Error states are understandable.
- [ ] Auth-aware UI behaves correctly for signed-in and signed-out paths if touched.
- [ ] Supabase reads/writes/auth behavior works if touched.
- [ ] AI route fallback/error behavior works if touched.

## UI Checks
- [ ] No text overlap on mobile.
- [ ] No clutter added to Today or primary workflows.
- [ ] Next best action remains clear.
- [ ] Existing functionality is preserved.
- [ ] Screenshot or visual evidence captured for UI changes.

## Deployment Checks
- [ ] Required env vars are documented and not committed.
- [ ] Vercel build assumptions reviewed.
- [ ] Cron/API behavior checked if touched.
- [ ] Production-only config changes have rollback notes.
