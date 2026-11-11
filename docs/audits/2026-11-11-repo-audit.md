# Repo audit: RunSmart web, 2026-11-11

Branch `claude/2026-11-11-runsmart-repo-audit`, from `main` at 8b067bc1.
Baseline on `main` (`v0/`): lint 0 errors / 1,657 warnings; `type-check` and `tsc --noEmit` clean; Vitest 1,498 passed, 2 skipped; `next build` passes.

## Urgent: credentials committed to this public repo

| File | What |
|------|------|
| `v0/scripts/apply-migrations.js`, `check-db.js`, `test-supabase.js` | **service_role** key for Supabase project `biilxiuhufkextvwqdob` (bypasses row-level security) |
| `v0/scripts/test-complete-backend.js`, `test-implementation.js` | anon key, same project |
| `docs/implementation-reports/SUPABASE_FIX_IMPLEMENTATION.md` | service_role key, same project |
| `SUPABASE-AUTH-CONFIGURATION.md` | anon key for `dxqglotcyirxzyqaxqln` |

The code points at `dxqglotcyirxzyqaxqln` 20 times and `biilxiuhufkextvwqdob` 7 times. If `biilxiuhufkextvwqdob` still exists, anyone can read and write all of its data. This branch deletes the scripts and redacts the docs. **The keys stay in git history until rotated.**

## Fixed in this branch

| What | Why it was safe |
|------|-----------------|
| Deleted the 5 key-bearing scripts; redacted the 2 docs | One-off scripts from 2025-11, referenced only by an old ESLint error dump |
| Pre-commit hook also blocks `sbp_…` and `sb_secret_…` | Same gap as Resumely web |
| **Untracked the root `node_modules/` (3,757 files)** | Committed in the initial commit even though `.gitignore` excludes it. Verified with it moved away (as a fresh CI clone sees it): lint, both type-checks, Vitest and build all pass |
| Deleted 70 `v0/` source files nothing imports (26 old dashboard/feature components, 21 unused shadcn primitives, 1 hook, 22 `lib/` modules incl. 5 `lib/debugging/*.js`). Kept `lib/server/ai-insights-worker.ts`: it is a BullMQ worker started as its own process, which an import graph cannot see | Import resolution across all of `v0/` incl. tests and dynamic `import()`; newest file last touched 2026-04-27. Lint, type-check, Vitest, build pass after |
| Deleted `apps/ios-old-old/` (50 files) | `tasks/progress.md` already records it as dead; the shipping app is the `apps/ios-native` submodule |
| `v0/` root: 26 reports moved to `docs/archive/v0-root-reports/`; 111 debug scripts, logs, screenshots, Lighthouse dumps, `.ps1`/`.bat`, backups and Vitest output files deleted (Vitest outputs now ignored) | Nothing in code, config or CI reads them; the screenshot PNGs are outputs of debug e2e specs |
| Repo root: 61 → 18 tracked files. Reports moved to `docs/archive/root-reports/`; accidental files deleted (`tatus --porcelain`, `e --abbrev-ref …`, `patch.txt`, `commit_message.txt`, `tmp_chat_screen_backup.tsx`, `tsc-output.txt`); orphan `BMAD-METHOD` gitlink removed (no `.gitmodules` entry) | Kept `AHA_MOMENTS.md`, `DEPLOYMENT-STATUS.md` and the architecture `.txt` because docs link to them |

## For your review (not changed)

1. **Rotate the leaked keys** (founder only). See the PR.
2. **`v0/capacitor.config.ts` points iOS at `../apps/ios`, which does not exist.** Recommend: delete the Capacitor config and `@capacitor/*` deps if the native app replaced it, or point it at the right path.
3. **1,657 lint warnings.** Recommend: one pass on the top rule, then make new warnings fail CI.
4. **`tsconfig.typecheck.json` excludes `app/api/**`**, so the 22 API routes the zod-4 migration touched are not type-checked (noted in progress 2026-10-29). Recommend: bring `app/api` back into the type-check.
5. **Two test failures noted in progress (2026-10-29)** did not reproduce today (1,498/1,498).
6. **`tasks/progress.md` fields run to thousands of words**; the rule is 25 words per field. Recommend: move history to the session log.
7. **Repo pack is 325 MB.** Old `node_modules` and screenshots stay in history. Recommend: leave, or rewrite history only alongside key rotation.
8. **Unclear folders:** `backend/` (a Python file and `yolo_log.txt`, 2025-12), `services/` and `packages/shared` (not referenced from `v0/`), `video-production/` (40 files), `GTM/`, `.bmad-core/` (2025-07), `.codex/` (189 files), `.cursor/` (146 files). Recommend: archive what no longer runs.
9. **41 stale remote branches** (20 unmerged, 21 merged and not deleted).
10. **Is `v0/lib/server/ai-insights-worker.ts` running anywhere?** The Garmin sync enqueues `ai-insights` jobs (`lib/server/garmin-sync-queue.ts`), but nothing in this repo starts the worker (`services/worker` consumes a different queue; no script, cron or CI step). If no host outside the repo runs it, those jobs pile up in Redis unprocessed. Recommend: check your worker host; if nothing runs it, either start it or stop enqueueing.
11. **Stale doc pointers to deleted files:** `v0/docs/QUICK-WINS-DEPLOYMENT.md:280` (`lib/seo.ts`), `v0/docs/OPTIMIZATION_SUMMARY.md` and `v0/docs/IMPLEMENTATION_GUIDE.md` (`use-optimized-state`, `lib/debugging/`). No runtime effect.
12. **`docker-compose.yml`, `.dockerignore`, `README-DOCKER.md`**: nothing in CI or Vercel uses Docker. Recommend: confirm and remove.
