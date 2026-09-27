# Agent Lessons

Reusable lessons for Claude Code, Codex, Cursor, and other agents.

## Active Lessons

### Lesson: Mobile Auth Links Need One Verified Cross-Layer Contract
- Trigger: A native Supabase PKCE flow uses a hosted HTTPS callback.
- Problem: A wrong AASA bundle ID, a redirected association domain, or server-side code exchange can each strand the same user while every individual component appears configured.
- Future Rule: Test the exact team/bundle ID, canonical no-redirect AASA host, native associated domain, callback source marker, fixed custom-scheme fallback, and on-device PKCE exchange together.

### Lesson: Keep Agent OS Router Files Thin
- Trigger: Installing or updating project instructions.
- Problem: Long root instruction files waste tokens and reduce compliance.
- Future Rule: Put only routing and universal rules in `AGENTS.md`, `CLAUDE.md`, and `CODEX.md`; move detailed process into `.agent-os/`.

### Lesson: Verify Repository Root Before Acting
- Trigger: Working from parent directories with nested repos.
- Problem: Commands can run in the wrong folder and miss git/app context.
- Future Rule: Confirm the actual git repo and app directory before editing or running package commands.

### Lesson: Do Not Retry the Same Debug Fix Repeatedly
- Trigger: Recurring bug work.
- Problem: Repeating one failed fix burns time and hides root cause.
- Future Rule: After two failed attempts, widen investigation with logs, tests, browser evidence, or config checks.

### Lesson: Supabase `.single()` Can Cause False Errors
- Trigger: Supabase lookup returns 406 or no rows.
- Problem: `.single()` errors on zero or multiple rows.
- Future Rule: Use `.maybeSingle()` unless exactly one row is guaranteed and an error is desired.

### Lesson: UI Changes Need Visual Evidence
- Trigger: Redesigns, layout changes, responsive fixes.
- Problem: Code can pass while mobile layout regresses.
- Future Rule: For UI changes, run a browser/mobile viewport check and capture screenshot or clear visual notes.

### Lesson: Save Approved Specs Before Implementation
- Trigger: Starting implementation when the approved spec only exists in chat history.
- Problem: Agents have to reconstruct scope, which increases ambiguity and risk.
- Future Rule: Before implementing a feature story, save the approved spec in `docs/specs/` or explicitly name the spec source in `tasks/todo.md`.

### Lesson: Smoke New Test Files Before Moving On
- Trigger: Adding a new focused test file.
- Problem: A missing closing delimiter in a new test file can hide behind otherwise-passing neighboring suites until the full command runs.
- Future Rule: After creating a new test file, run that exact file once before treating broader validation as meaningful.

### Lesson: Date Tests Must Assert Calendar Units, Not Elapsed Milliseconds
- Trigger: A test checks that a projected/scheduled date is N days or weeks away.
- Problem: Production date math built on `setDate()` preserves local wall-clock time, so elapsed **milliseconds** shift by an hour whenever the window crosses a DST transition. A test asserting a fixed ms delta then fails for a two-month stretch each year while the production code is correct. This has now happened twice: `activation-loop.test.ts` (fixed 2026-08-08, failed every Thu/Sat) and `userInsightService.test.ts` (fixed 2026-09-19, failed daily from ~2026-09-01 to ~2026-11-14 because now + 8 weeks crossed the end of Israel Daylight Time on 2026-10-25).
- Future Rule: Assert on calendar units. Normalise both sides to start-of-day (`new Date(y, m, d)`) and compare, or build the expectation with the same calendar arithmetic production uses. Never assert `date.getTime() - now` against `days * 24 * 3600 * 1000`. Before fixing, check whether the production logic or the test is wrong — in both cases so far it was the test.

### Lesson: Run the Toolchain From node_modules Outside ~/Documents
- Trigger: `tsc`, `vitest` or `next build` in `v0/` is slow, times out at module load, or behaves like an old version.
- Problem: On 2026-09-27 the main checkout's `v0/node_modules` had Next 14.2.35 installed against a lockfile pinning 16.3.0 (`next build --webpack` failed with "unknown option"), and iCloud File Provider stalls made module-load timeouts look like test failures. A clean `npm ci` of the same lockfile, placed outside `~/Documents` and symlinked in, ran the full suite in about 400s with the three "environmental" failures gone. Separately, the committed lockfile does not install `@testing-library/dom` (a peer of `@testing-library/react`, imported by `vitest.setup.ts`), so a clean install cannot load any vitest file until it is added.
- Future Rule: Before debugging a build or test failure, check `node -e "console.log(require('next/package.json').version)"` against `package.json`. Keep a clean install off the synced path. Adding `@testing-library/dom` to devDependencies needs the founder's OK.

### Lesson: PostHog Drops identify() Called Before init Finishes
- Trigger: Identifying users from auth code that runs at mount.
- Problem: `lib/posthog-provider.tsx` loads PostHog lazily (idle callback, then a dynamic import), and PostHog ignores `identify()` until `init` has finished. Auth restores the session earlier, so a direct call is lost silently and returning users stay anonymous.
- Future Rule: Route identity through `lib/analytics-identity.ts`, which holds the id until PostHog's `loaded` callback applies it. Never call `window.posthog.identify` directly.

### Lesson: npm audit fix Can Trade Low Advisories For A High One
- Trigger: Clearing `audit-ci` failures with `npm audit fix`.
- Problem: On 2026-09-27 `npm audit fix` moved `ai`/`@ai-sdk/openai` to the newest v5 line, whose `@ai-sdk/provider-utils@3.0.39` depends on `undici@^5.29.0` (high, GHSA-35p6-xmwp-9g52). Two low findings became one high, which fails the gate the fix was meant to pass.
- Future Rule: Bump named packages (`npm install pkg@version`, `npm update <transitive>`) and re-run `npm audit` after each step. Never run a bare `npm audit fix` on this repo.

### Lesson: Back-To-Back Merges Can Leave Production On An Older Commit
- Trigger: Merging several PRs to `main` within minutes of each other.
- Problem: Each merge starts its own Vercel Production deployment, and they finish out of order. On 2026-09-27 the deployment for `b039ce4` finished five minutes after the one for the newer `eb3e641`, so production served code without the #133 endpoint deletions while CI and the merge both looked done.
- Future Rule: After the last merge, confirm the newest Production deployment is the `main` HEAD SHA (`gh api "repos/nadavyigal/Running-coach-/deployments?environment=Production&per_page=3"`), then probe production. A merge is not a deploy.

## Lesson Template
Use `.agent-os/templates/lesson-template.md` for new entries.
