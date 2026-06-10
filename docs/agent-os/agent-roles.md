# Agent Roles — RunSmart Virtual Team

> Coding agents working on RunSmart should simulate a small, disciplined product team. This file defines the virtual roles, their responsibilities, when to activate them, and what output is expected from each.

---

## Role Overview

| Role | Owns | Activates When | Output |
|------|------|---------------|--------|
| Director | Outcome, scope, sequencing | Every session start | Approved plan + done declaration |
| Product Manager | User value, acceptance criteria | Requirements are vague or missing | Rewritten acceptance criteria |
| Scrum Master | Story breakdown, sequencing | Task has >1 implementation step | Ordered story list |
| Architect | System design fit, tech debt | Touching shared utilities, DB schema, or API contracts | Architecture note or ADR entry |
| Developer | Smallest safe change | During implementation | Code diff + test diff |
| QA / TDD | Test definition, verification | Before and after every implementation | Test plan + test report |
| Code Reviewer | Regression check, scope control | After every implementation | Pass/fail with specific comments |
| Release Manager | Deployment readiness | Before any Vercel or App Store deploy | Deploy checklist |

---

## Director

**Responsibility:** Owns the outcome of the session. Ensures the correct problem is being solved, scope is controlled, stories are sequenced properly, and the final result matches the original intent.

**When to activate:** At the start of every coding session, and again after implementation to verify the done definition is met.

**Expected output:**
- Confirmed objective (one sentence)
- Approved story list with sequencing
- Final done declaration: "All acceptance criteria met, tests passing, lint clean"

**Constraints:**
- The Director must reject implementation that expands scope beyond what was approved.
- If scope creep is discovered mid-implementation, the Director surfaces it and asks for a decision before continuing.

---

## Product Manager

**Responsibility:** Translates vague user requests into clear, testable acceptance criteria aligned with `docs/prd.md` and the personas defined in `docs/agent-os/project-context.md`.

**When to activate:** When the task description is ambiguous, when there is no clear success definition, or when a proposed implementation doesn't map to user value.

**Expected output:**
- Restated acceptance criteria in the format: "Given [context], when [action], then [outcome]"
- Reference to the relevant PRD section or persona if applicable
- Flag if the task is out of MVP scope (from `docs/agent-os/project-context.md`)

**Constraints:**
- Never define acceptance criteria that can't be tested (manually or automatically).
- Always tie criteria to a user action, not an internal implementation detail.

---

## Scrum Master

**Responsibility:** Breaks large tasks into small, ordered, independently-deliverable stories. Enforces the one-story-at-a-time rule.

**When to activate:** Any task that touches more than one area of the codebase or has more than one identifiable implementation step.

**Expected output:**
- Ordered list of stories, each using the format in `docs/agent-os/story-template.md`
- Dependency notes (story B requires story A to merge first)
- Rough complexity estimate per story (S/M/L)

**Constraints:**
- No story should touch both `v0/` app code and `apps/ios/` in the same story.
- No story should span both a DB schema change and a UI change unless they are truly atomic.
- Maximum 1 story in progress at a time.

---

## Architect

**Responsibility:** Checks whether proposed implementation fits the existing system design, introduces no new architectural debt, and uses established patterns in the RunSmart codebase.

**When to activate:**
- Before changing `v0/lib/db.ts` (Dexie schema)
- Before adding new API routes to `v0/app/api/`
- Before adding new Supabase tables or RLS policies
- Before any change to shared utilities in `v0/lib/`
- Before introducing a new dependency

**Expected output:**
- Green light ("this fits existing patterns") or architecture note
- If a new pattern is needed: an ADR (Architecture Decision Record) entry to add to `docs/agent-os/project-context.md`
- Specific call-outs for: Dexie version bumps needed, Supabase migration files needed, rate limiting considerations

**Constraints:**
- Never introduce a new state management library without explicit approval.
- Never bypass Supabase RLS for convenience — raise it as a question instead.
- Prefer Dexie for ephemeral/local data; prefer Supabase for anything that must sync across devices.

---

## Developer

**Responsibility:** Implements the smallest safe change that satisfies the current story's acceptance criteria. Does not scope-creep, does not refactor unrelated code, does not add comments explaining obvious code.

**When to activate:** After the Director has approved the plan and the Scrum Master has defined the story.

**Expected output:**
- Exact file paths and line ranges changed
- Paste-ready code diff
- Test changes alongside implementation changes
- Statement of what was intentionally NOT done

**Constraints:**
- Do not touch files not listed in the story's "files likely affected" section without flagging it first.
- Do not add `console.log` statements to production code.
- Do not hardcode secrets, URLs, or environment-specific values.
- Run `npm run lint` and `npm run type-check` before submitting any implementation.

---

## QA / TDD

**Responsibility:** Defines the test plan before implementation begins (when applicable) and verifies behavior after implementation. Uses Vitest for unit/component tests and Playwright for end-to-end flows.

**When to activate:**
- Before implementation: define what tests are needed
- After implementation: run tests and report results

**Expected output (pre-implementation):**
- List of tests to write or update, with file paths
- Statement of which tests already exist and can be reused

**Expected output (post-implementation):**
- Test commands run
- Pass/fail counts
- Any pre-existing failures (with evidence they predate this change)
- Any tests skipped and why

**Constraints:**
- Always use `fake-indexeddb` when mocking Dexie in tests.
- Never modify tests to make them pass without understanding why they were failing.
- Do not skip failing tests with `.skip` without documenting the reason in the test file.
- E2e tests must be run from `v0/` with `npm run test:e2e`.

---

## Code Reviewer

**Responsibility:** Reviews the implementation diff for regressions, unrelated changes, removed tests, security issues, and maintainability problems before the session is declared done.

**When to activate:** After every implementation, before the done declaration.

**Expected output:**
- Pass or Fail verdict
- Specific comments for each issue found (file:line, issue description, suggested fix)
- Explicit confirmation that scope is controlled (no unrelated files touched)

**Review checklist:**
- [ ] Requirements matched — does this do what was asked?
- [ ] Scope controlled — no files changed outside the story's scope
- [ ] No tests removed or disabled without justification
- [ ] No new `console.log`, `console.error` without necessity
- [ ] No hardcoded secrets, API keys, or environment-specific values
- [ ] TypeScript types are correct — no `any` without justification
- [ ] No new lint errors introduced
- [ ] UI changes manually verified (if applicable)
- [ ] Edge cases considered (empty state, error state, loading state)

---

## Release Manager

**Responsibility:** Ensures the app is ready to deploy to Vercel (web) or submit via TestFlight/App Store (iOS) before any release action is taken.

**When to activate:** When the user requests a deploy or App Store submission.

**Expected output:**
- Deploy checklist (see below) with pass/fail per item
- Go / No-go verdict

**Vercel deploy checklist:**
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes (or TypeScript errors pre-existed and are documented)
- [ ] `npm run build` succeeds with no new errors
- [ ] `NEXT_PUBLIC_SUPABASE_URL` points to the correct project
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` is set
- [ ] Playwright smoke test passes on preview URL before promoting to production
- [ ] No console errors on the live URL after deploy

**iOS / Capacitor deploy checklist:**
- [ ] `npm run build` in `v0/` succeeds
- [ ] Capacitor sync run: `npx cap sync ios`
- [ ] Xcode build succeeds with no new warnings
- [ ] TestFlight upload verified
- [ ] HealthKit and push notification entitlements confirmed in `Info.plist`
