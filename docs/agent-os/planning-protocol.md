# Planning Protocol — RunSmart

> This is the mandatory planning flow that all coding agents must follow before writing any implementation code. Skipping or abbreviating this protocol leads to scope creep, broken tests, and wasted work.
>
> Reference roles: `docs/agent-os/agent-roles.md` | Templates: `docs/agent-os/story-template.md`, `docs/agent-os/task-template.md`

---

## When This Protocol Applies

Apply this protocol when:
- Implementing a new feature or user story
- Fixing a bug that touches more than one file
- Making any change to shared utilities (`v0/lib/`), DB schema (`v0/lib/db.ts`), or API routes
- Making any change that could affect other screens or components

You MAY skip to implementation without the full protocol for:
- Single-line typo/copy fixes
- Updating a single hardcoded string
- Adding a missing CSS class with no logic change

When in doubt, run the protocol.

---

## Protocol Steps

### Step 1 — Restate the Objective

Write one sentence: what will exist or work after this change that doesn't now?

> Example: "The Today screen will show a 7-day HRV trend sparkline when HRV data is present in Dexie."

If you cannot write this sentence because the task is ambiguous, **stop and ask for clarification before continuing.**

---

### Step 2 — Identify Assumptions

List any assumptions you are making that are not explicitly stated in the task. For each assumption, ask yourself: "If this assumption is wrong, would the implementation be wrong?" If yes, ask the user before proceeding.

> Example assumptions:
> - "I assume the chart library (recharts) is already installed" → verify in `v0/package.json`
> - "I assume HRV data is stored in Dexie, not only in Supabase" → verify in `v0/lib/db.ts`

---

### Step 3 — Inspect Relevant Files

Before writing a single line of code, read:

1. **`tasks/lessons.md`** — check if this is a known recurring bug with a documented fix path
2. **`docs/agent-os/project-context.md`** — confirm the task is in scope and check for relevant architecture decisions
3. **`docs/prd.md`** — if a product decision is needed, check what the PRD says
4. **Directly impacted source files** — read the actual current code before planning changes
5. **Relevant story files in `docs/stories/`** — check if a story already defines this work

Report what you found. Do not plan based on assumptions about file content.

---

### Step 4 — Identify Impacted Areas

List every file that will change and why. For each file:
- **File path** (exact)
- **What changes** (one sentence)
- **Why** (one sentence)

If during this step you discover a file you weren't expecting to need, note it. If it's outside the task scope, flag it to the user before adding it to the plan.

> Example:
> - `v0/components/TodayScreen.tsx` — add HRVSparkline component to the recovery section
> - `v0/components/HRVSparkline.tsx` — new component, reads from dbUtils
> - `v0/lib/dbUtils.ts` — add `getRecentHRV(userId, days)` utility function
> - `v0/components/__tests__/HRVSparkline.test.tsx` — new unit tests

---

### Step 5 — Define Success Criteria

Write 2–5 acceptance criteria in Given/When/Then format. Each criterion must be independently testable.

> Example:
> - Given a user with ≥3 HRV measurements, when Today screen loads, then HRV sparkline is visible
> - Given a user with 0 HRV measurements, when Today screen loads, then placeholder "No HRV data yet" is shown
> - Given any state, when Today screen loads, then there are no console errors

---

### Step 6 — Break Into Stories

If the task requires more than one distinct change, break it into ordered stories. Use the format in `docs/agent-os/story-template.md` for each story.

Rules:
- Each story must be independently committable (the app works after story N even if story N+1 is not started)
- No story should span both a DB schema change and a UI change unless they are truly atomic
- No story should touch both `v0/` and `apps/ios/` simultaneously
- Maximum complexity: one story per working session

**Story ordering example:**
1. Add `getRecentHRV` utility to `v0/lib/dbUtils.ts` + unit test
2. Build `HRVSparkline` component + unit test
3. Integrate `HRVSparkline` into `TodayScreen`

---

### Step 7 — Ask for Approval Before Implementing

**If any of the following are true, present the plan and ask for approval before writing code:**

- The plan touches more than 3 files
- The plan changes a shared utility (`v0/lib/`)
- The plan changes the Dexie schema (`v0/lib/db.ts`)
- The plan adds a new Supabase table or RLS policy
- The plan introduces a new dependency (`npm install`)
- The plan changes an API contract (request/response shape)
- The scope is larger than what was originally described

**Approval format:**

```
Objective: [one sentence]
Stories: [numbered list]
Files affected: [list]
Assumptions: [list]
Tests planned: [list]
Blockers or questions: [list — or "none"]

Ready to implement story 1. OK to proceed?
```

Do not start implementation until you receive a go-ahead.

---

### Step 8 — Implement One Story at a Time

After approval:
1. Implement story 1
2. Run the QA checks from `docs/agent-os/tdd-qa-protocol.md`
3. Report results
4. Ask: "Story 1 complete. Ready to proceed to story 2?"
5. Do not start story 2 until confirmed

---

### Step 9 — Final Review

After all stories are complete, run the review checklist from `docs/agent-os/review-checklist.md` and report:
- Requirements matched (yes/no — with evidence)
- Scope controlled (yes/no — list any unplanned files touched)
- Tests passed (command + result)
- Open questions for next session
