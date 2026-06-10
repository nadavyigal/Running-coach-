# Task Template

> Use this template when submitting a coding task to an agent (Codex, Claude Code, Cursor). A well-formed task prevents the agent from asking unnecessary questions mid-implementation and prevents scope creep.
>
> Copy, fill in, and paste as your prompt. Leave sections blank only if they genuinely don't apply — agents will ask about missing sections before coding.

---

## Goal

> One clear sentence. What should exist or work after this task that doesn't now?

[FILL IN]

---

## Background

> Why is this being done? What user problem does it solve? Link to the relevant PRD section, story, or issue if applicable.

[FILL IN — or reference: docs/prd.md §X, docs/stories/X.Y.Z.md]

---

## Files / Context to Read First

> Tell the agent exactly which files to read before planning. Don't make it guess.

- `tasks/lessons.md` — always read first for recurring bugs
- `docs/agent-os/project-context.md` — project state and decisions
- [list specific files relevant to this task]

---

## Constraints

> Hard limits the agent must not violate.

- Do not add new npm dependencies without asking
- Do not modify `.env*` files
- Do not change Supabase migrations without explicit instruction
- Do not touch `apps/ios/` when the task is in `v0/`
- [add task-specific constraints]

---

## Assumptions

> What can the agent assume without asking?

- [FILL IN — or leave blank to force the agent to surface its assumptions]

---

## Success Criteria

> How do we know this is done? Be specific and testable.

- [ ] [criterion 1]
- [ ] [criterion 2]
- [ ] Lint passes: `npm run lint` from `v0/`
- [ ] Tests pass: `npm run test -- --run` from `v0/`
- [ ] No new console errors

---

## Stories

> If this task has multiple steps, list them here in order. Use `docs/agent-os/story-template.md` format for each. The agent must complete one story and confirm before starting the next.

1. [Story 1 title]
2. [Story 2 title — depends on story 1]
3. [Story 3 title]

---

## Tests

> List specific test cases expected. The agent should write these before or alongside the implementation.

- Unit: [describe]
- Integration: [describe]
- Manual QA: [describe steps]

---

## QA Checklist

- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes (or pre-existing errors documented)
- [ ] `npm run test -- --run` passes
- [ ] No new console errors in browser DevTools
- [ ] UI tested at `max-w-md` (mobile breakpoint)
- [ ] [task-specific check]

---

## Risks

> What could go wrong? What should the agent check before implementing?

- [e.g., "This touches Dexie schema — confirm no version bump is needed before merging"]
- [e.g., "This changes a shared utility — check all callers before modifying the signature"]

---

## Final Response Format

The agent's response to this task should include:

1. **What was done** — one paragraph
2. **Files changed** — exact paths with line ranges
3. **Tests run** — command and output summary
4. **Tests NOT run** — and why
5. **Open questions** — anything that needs a decision before the next step
6. **What was NOT done** — anything explicitly out of scope
