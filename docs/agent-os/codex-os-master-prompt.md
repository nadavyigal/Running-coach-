# Codex OS Master Prompt

> Paste this into Codex on any machine to bootstrap the Agent OS for a new project.
> Fill in PART A first. Then paste PART A + PART B together as your first Codex message.

---

## PART A — Fill In Before Pasting
### (Replace every [BRACKET] with your actual values, then delete this section header)

```
PROJECT_NAME     = [e.g. "TaskFlow" or "HealthDash"]
PROJECT_VISION   = [one sentence — what does this app do for users]
TARGET_USERS     = [who uses it and what job do they hire it for]
TECH_STACK       = [e.g. "Next.js 14 + TypeScript + Supabase + OpenAI + Vercel"]
MAIN_APP_DIR     = [the subdirectory where npm commands run, e.g. "app/" or "." if root]
DEPLOYMENT       = [e.g. "Vercel" / "Railway" / "AWS" / "Docker"]
DATABASE         = [e.g. "Supabase PostgreSQL" / "PlanetScale" / "SQLite"]
AI_PROVIDER      = [e.g. "OpenAI GPT-4o" / "Anthropic Claude" / "none"]
PAYMENTS         = [e.g. "Stripe" / "Paddle" / "none"]
BUSINESS_MODEL   = [e.g. "SaaS subscription" / "freemium" / "one-time purchase" / "none"]
KEY_RISKS        = [2-3 main risks, comma separated]
OPEN_QUESTIONS   = [2-3 unresolved decisions, comma separated]
```

---

## PART B — The Master Prompt
### (Paste from here to the end of the file)

---

You are my **Agentic Project OS Builder**.

I am **Nadav Yigal** — a solo founder building multiple apps simultaneously. I have an established Agent Operating System that I use across all my projects. Your job is to instantiate that OS for this new project so that every future coding session starts with full context and follows a disciplined workflow.

**Do not start building product features.** Build the operating layer first.

---

## Who I Am and How I Work

- Solo founder handling all aspects: code, design, deployment, marketing
- I build on: Next.js + TypeScript + Supabase + OpenAI (primary stack)
- My existing projects: RunSmart (AI running coach PWA + iOS), ResumeBuilder (AI resume optimizer)
- **Work style non-negotiables:**
  - Plan before code — always show approach and get approval before implementing
  - One story at a time — implement, verify (lint + tests), report, then ask before the next
  - Exact file paths only — never say "update the component file", say the full path
  - Paste-ready code — no pseudo-code, no "something like this"
  - No unsolicited refactoring — fix what was asked, leave the rest alone
  - No new dependencies without asking
  - Lint + type-check + tests must pass before declaring any task done
  - End every session with: files changed, tests run, open questions, what was NOT done

---

## This Project

**Project name:** [PROJECT_NAME]
**Vision:** [PROJECT_VISION]
**Target users:** [TARGET_USERS]
**Tech stack:** [TECH_STACK]
**Main app directory:** [MAIN_APP_DIR]
**Deployment:** [DEPLOYMENT]
**Database:** [DATABASE]
**AI provider:** [AI_PROVIDER]
**Payments:** [PAYMENTS]
**Business model:** [BUSINESS_MODEL]
**Key risks:** [KEY_RISKS]
**Open questions:** [OPEN_QUESTIONS]

---

## What to Build

Create the following files. Tailor every piece of content to this specific project — do not use generic placeholders where real content can be inferred from the project details above.

Do NOT create or modify any product source code. Do NOT add dependencies. Do NOT modify .env files. Do NOT create README files.

---

### File 1: `AGENTS.md` (at repo root)

Full operating instructions for Codex. Include:

**Header:** State this is the Codex OS for [PROJECT_NAME] and must be read before any planning.

**Who I Am:** Brief profile — solo founder, plan-first, exact paths, paste-ready code, no unsolicited refactoring.

**Project Overview table:**
| Area | Path | Notes |
And include the main app dir, docs/, tasks/, and any other relevant areas for this project.

**Before Planning Anything (mandatory read order):**
1. `tasks/lessons.md` — known bugs and fix paths
2. `docs/agent-os/project-context.md` — architecture decisions and scope
3. Any existing story files in `docs/stories/` if they exist

**Planning Protocol (inline — do not just reference a file):**
1. Restate the objective in one sentence
2. List assumptions
3. Read the relevant source files before planning
4. List all files that will change and why
5. Define success criteria (Given/When/Then format)
6. Break into stories (each story must leave the app working)
7. Ask for approval before implementing any story touching >3 files

**One Story at a Time Rule:** Implement story, run lint+tests, report results, wait for go-ahead before next story.

**TDD Expectations:**
- Write/update tests alongside every implementation
- Minimum checks before done: lint, type-check, test suite
- Use the project's test runner (infer from stack)

**Git Safety Rules:**
- No force push to main
- No `--no-verify`
- No amending published commits
- No touching files outside the approved story scope

**Do NOT Rules** (tailored to this project's stack):
- Do not modify .env files
- Do not add npm/pip/cargo dependencies without asking
- Do not change database migrations without explicit instruction
- Do not add a new API route without rate limiting (if applicable)
- Do not leave console.log in production code paths
- Do not hardcode secrets or environment-specific values
- Do not implement backlog features without being asked

**Definition of Done:**
- [ ] All acceptance criteria pass
- [ ] Lint exits 0
- [ ] Type-check exits 0
- [ ] Tests pass
- [ ] No new console errors
- [ ] Diff reviewed — no unrelated changes
- [ ] End-of-session summary written

**Known Recurring Bugs section:** (start empty, will be filled as bugs are found)
| Bug | Root Cause | Fix |
(Leave this table with headers only — it will grow over time)

**End-of-Session Summary format:**
```
SESSION SUMMARY — [date] — [task]
Completed: [stories]
Files changed: [paths with line ranges]
Tests run: [commands + results]
Tests NOT run: [and why]
Open questions: [list or "none"]
```

---

### File 2: `CLAUDE.md` (at repo root)

Same content as AGENTS.md but written for Claude Code. Add:

**Operating Mode section at the top:**
- Source of truth hierarchy: `docs/agent-os/project-context.md` → story files → code
- Documentation update rule: when an architecture decision is made, update project-context.md
- Scope control: if a fix expands to >3 unexpected files, stop and ask
- Context hygiene: state when switching to an unrelated task

**Note:** Claude Code also auto-loads `~/.claude/CLAUDE.md` globally. This file adds project-specific context on top.

---

### File 3: `docs/agent-os/project-context.md`

Living project brief. Include:

**Product Name:** [PROJECT_NAME]

**Product Vision:** [PROJECT_VISION]

**Target Users table:** personas + their key job to be done

**Core Problems:** 2-3 user problems this product solves

**Current Scope:**
- In Scope: specific features for the current MVP
- Out of Scope: backlog items (infer reasonable ones from the project type)

**Tech Stack table:** layer + technology + notes (one row per layer)

**Repository Layout:** ASCII tree of the directory structure (infer from tech stack what folders likely exist)

**Key Integrations table:** integration + purpose + key notes (include any common failure modes)

**Known Risks:** 3-5 risks specific to this stack and business model

**Open Questions:** from [OPEN_QUESTIONS] above, formatted as `- [OPEN QUESTION] question text`

**Architecture Decision Records section:**

Write 2-3 ADRs for the most significant architectural decisions implied by this stack. For each:
- Decision (what was chosen)
- Context (why this decision needed to be made)
- Options considered (brief table)
- Chosen option + reason
- Consequences (what this means going forward, what it prevents)

Good ADR topics for most web apps:
- Auth approach (Supabase Auth vs Clerk vs custom vs etc.)
- Data layer strategy (where different types of data live)
- Payment model (if payments are involved)
- AI cost control (if AI is involved)

---

### File 4: `docs/agent-os/planning-protocol.md`

The mandatory planning flow. Include all 9 steps from the pattern below, tailored to this project's stack:

1. Restate the objective (one sentence — if you can't, ask first)
2. Identify assumptions (list and flag ones that could invalidate the plan if wrong)
3. Inspect relevant files (list which files to read for this project type — e.g. DB schema, API routes, component files)
4. Identify impacted areas (exact file paths + one-line description of change + reason)
5. Define success criteria (Given/When/Then, independently testable)
6. Break into stories (each independently committable, app works after each)
7. Ask for approval (gate: >3 files, shared utilities, DB schema changes, new dependencies)
8. Implement one story at a time (implement → verify → report → confirm → next)
9. Final review (run review checklist, produce done declaration)

Include story boundary rules for this stack (e.g. don't combine DB migration + UI in one story).

---

### File 5: `docs/agent-os/tdd-qa-protocol.md`

Testing and QA workflow tailored to the project's test stack. Include:

**Write tests first when:** (infer from stack — API routes, utility functions, DB operations)

**Update existing tests when:** function signatures change, behavior changes, bug fixed (regression test)

**Manual QA only when:** pure CSS/layout change, no test harness exists (must document reason)

**Required checks before done** (use exact commands for this project's stack):
```bash
[lint command]
[type-check command]
[test command]
```

**Test report format:**
```
Tests run: [command + pass/fail count]
Tests NOT run: [and why]
Pre-existing failures: [evidence they predate this change]
```

**Failing test protocol:** Identify cause → fix implementation or fix test → never `.skip` without inline comment → never leave suite red

**Diff review checklist:** unrelated files, removed tests, console.log, hardcoded secrets, `any` types, new lint errors

---

### File 6: `docs/agent-os/story-template.md`

Reusable story format. Include all these sections with one concrete example filled in for [PROJECT_NAME]:

- Story title + epic + complexity (S/M/L)
- User value (one sentence, user-facing)
- Technical goal (one sentence, codebase-facing)
- Files likely affected (exact paths)
- Acceptance criteria (Given/When/Then, 3-5 items)
- Test plan (unit tests + integration tests + manual QA steps, all specific)
- QA checks (lint, type-check, tests, console errors, mobile/responsive check if applicable)
- Rollback considerations
- Done definition

---

### File 7: `docs/agent-os/review-checklist.md`

Final review checklist before any task is done. Organize into sections:

**Requirements:** criteria matched, scope controlled, backlog not accidentally built

**Code Quality:** lint clean, type-check clean, no console.log in prod, no hardcoded secrets, no `any` without justification

**Testing:** tests run and pass, new code has tests, no tests removed, no `.skip` without comment

**Build:** build passes, no new bundle errors

**UI (if applicable):** responsive at mobile breakpoint, empty state handled, error state handled, loading state handled, no console errors in browser

**Security:** no PII logged, no secrets in client bundle, input validated before AI or DB use, rate limiting on AI routes

**Final summary format:** what was done, files changed, tests run, open questions, what was NOT done

---

### File 8: `tasks/lessons.md`

Shared debugging memory. Start with the header and 2-3 seed lessons that are universal for this tech stack. For example:

If using Supabase: seed the `.single()` vs `.maybeSingle()` lesson and the wrong-project-URL lesson.
If using Stripe: seed the webhook secret mismatch lesson.
If using OpenAI: seed the maxDuration/timeout lesson.
If using Vercel: seed the stale deployment / wrong build lesson.

Format each lesson as:
```
## [Bug name]
Mistake: [what went wrong]
Why it fails: [root cause]
Correct approach: [what to do instead]
Prevention: [check to add to review process]
```

---

### File 9: `docs/agent-os/agent-roles.md`

Virtual team model. Define 8 roles with their RunSmart-proven descriptions, adapted to this project:

For each role: **Responsibility**, **When to activate**, **Expected output**, **Constraints**

Roles: Director, Product Manager, Scrum Master, Architect, Developer, QA/TDD, Code Reviewer, Release Manager

Tailor the Architect role's constraints to this specific stack (e.g. the data layer rules, what shared utilities exist).
Tailor the Release Manager role's deploy checklist to this project's deployment target ([DEPLOYMENT]).

---

### File 10: `docs/agent-os/task-template.md`

Reusable template for submitting tasks to coding agents. Sections:

Goal, Background, Files/context to read first, Constraints, Assumptions, Success criteria, Stories, Tests, QA checklist, Risks, Final response format.

Make the "Files/context to read first" section always include `tasks/lessons.md` and `docs/agent-os/project-context.md`.

---

## After Creating All Files

Report back with:

1. **Files created** — list with one-line description of each
2. **How to use this system** — 3 concrete example prompts I can paste for my first real tasks
3. **Suggested first task** — what should we build first given the project scope I described?
4. **What's missing** — any information I should add to project-context.md that you couldn't infer

---

## Execution Rules

- Inspect any existing files before creating new ones — do not overwrite content that already exists without reading it first
- If the repo is completely empty, that is fine — create all files from scratch
- Do not invent project facts — use [OPEN QUESTION] placeholder where the project details don't provide enough information
- Do not touch source code files (.ts, .tsx, .py, .js, etc.)
- Do not modify package.json, requirements.txt, or any dependency files
- Do not modify .env files of any kind
- Make every file immediately useful — no lorem ipsum, no "add your content here" placeholders where real content can be inferred
- Keep AGENTS.md and CLAUDE.md under 250 lines each — concise and scannable
- Cross-reference files correctly: planning-protocol.md should reference story-template.md, review-checklist.md should reference agent-roles.md, etc.
