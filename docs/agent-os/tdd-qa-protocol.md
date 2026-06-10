# TDD & QA Protocol — RunSmart

> Required testing and quality assurance workflow. Agents must follow this protocol before declaring any story or task complete.
>
> Stack: **Vitest** (unit + component) · **Playwright** (e2e) · **fake-indexeddb** (Dexie mocking)

---

## When to Write Tests First (TDD)

Write the test before the implementation when:
- Adding a new utility function to `v0/lib/`
- Adding a new API route to `v0/app/api/`
- Adding a new Dexie DB operation to `v0/lib/dbUtils.ts`
- Adding a new hook with non-trivial logic

**TDD flow:**
1. Write a failing test that describes the expected behavior
2. Run it to confirm it fails for the right reason
3. Implement the minimum code to make it pass
4. Refactor if needed (but keep tests green)

---

## When to Update Existing Tests

Update existing tests when:
- Changing a function's inputs, outputs, or side effects
- Changing a component's props interface
- Changing a DB schema field that existing tests reference
- Fixing a bug — add a regression test to prevent recurrence

---

## When Manual QA Is Acceptable

Manual QA may substitute for automated tests when:
- The change is a pure layout/visual adjustment with no logic
- The component has no test harness and creating one would exceed the story's scope

**If manual QA is used, you must:**
1. Document the manual steps taken
2. Document why no automated test was written
3. Note it as a testing gap in the final summary

Manual QA is never a substitute for `npm run lint` and `npm run type-check`.

---

## Required Checks Before Declaring "Done"

Run these commands from `v0/` in order:

```bash
npm run lint
npm run type-check   # if the script exists; otherwise tsc --noEmit
npm run test -- --run
npm run build        # for any change that could affect the production build
```

All must pass before declaring the task complete.

For e2e tests (UI flows):
```bash
npm run test:e2e
```
Run e2e tests when: a new user flow was added, a screen navigation was changed, or an API route was added.

---

## Test Report Format

At the end of every implementation, report:

```
Tests run:
  npm run test -- --run
  Result: [X passed, Y failed, Z skipped]
  Failed: [test name — reason if known]

Tests NOT run:
  [test type] — [reason]

Pre-existing failures (if any):
  [test name] — confirmed pre-existing via git blame / last CI run
```

---

## Handling Failing Tests

**Never leave the test suite red after your changes.**

If a test fails after your change:
1. **Determine cause:** Is it caused by your change, or was it pre-existing?
2. **If caused by your change:** Fix your implementation or fix the test (not by deleting or `.skip`-ping it).
3. **If pre-existing:** Document it with evidence (e.g., "this test was already failing on `main` before this branch") and note it explicitly in your summary.
4. **Never use `.skip` without a comment explaining the reason** in the test file itself.

---

## Dexie Testing Rules

- Always import and use `fake-indexeddb` when testing code that reads/writes Dexie.
- Use `beforeEach` to reset the database state — never share state between tests.
- Test both the happy path (data exists) and the empty state (no data).

```typescript
import 'fake-indexeddb/auto';
import { db } from '@/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});
```

---

## Diff Review (Before Submitting)

Before reporting implementation complete, review your own diff for:

| Check | Pass condition |
|-------|---------------|
| Unrelated files | No files changed outside the story scope |
| Removed tests | No test file lines deleted without replacement |
| New console.log | None in production code paths |
| Hardcoded secrets | No API keys, passwords, or env-specific URLs |
| TypeScript `any` | None added without `// eslint-disable-next-line` and a comment |
| New lint errors | `npm run lint` exits 0 |
| TODO/FIXME | None left unless documented as intentional tech debt |

---

## Playwright E2E Conventions

- Tests live in `v0/e2e/`
- Run with `npm run test:e2e` from `v0/`
- Each test file maps to one user flow (e.g., `onboarding.spec.ts`, `record-run.spec.ts`)
- Use `page.getByRole` and `page.getByTestId` — avoid CSS selectors
- Smoke test on preview URL after Vercel deploy before promoting to production
