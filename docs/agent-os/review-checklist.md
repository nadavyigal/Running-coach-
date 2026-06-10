# Review Checklist — RunSmart

> Run this checklist before declaring any task or story complete. The Code Reviewer agent role (see `docs/agent-os/agent-roles.md`) is responsible for executing this checklist.
>
> Mark each item ✅ (pass), ❌ (fail — describe issue), or N/A (not applicable — explain why).

---

## Requirements

- [ ] **Requirements matched** — the implementation does what was asked, and all acceptance criteria from the story are satisfied
- [ ] **No undocumented scope change** — if something unexpected was discovered and added, it was discussed and approved before implementation
- [ ] **PRD alignment** — the change is consistent with `docs/prd.md` and `docs/agent-os/project-context.md`

---

## Scope Control

- [ ] **No unrelated files changed** — diff contains only files listed in the story's "files likely affected" section (or newly approved additions)
- [ ] **No unrelated refactoring** — surrounding code was left as-is unless it was blocking the task
- [ ] **No new dependencies added silently** — `package.json` unchanged, or change was explicitly approved

---

## Code Quality

- [ ] **TypeScript clean** — `npm run type-check` exits 0, or pre-existing errors are documented
- [ ] **Lint clean** — `npm run lint` exits 0
- [ ] **No new `console.log`** in production code paths (warn/error acceptable if intentional)
- [ ] **No hardcoded values** — no API keys, static URLs, or env-specific strings outside `.env` files
- [ ] **No `any` without justification** — any new `any` types have a comment explaining why
- [ ] **No TODO/FIXME left** — unless documented as intentional tech debt in a follow-up story

---

## Testing

- [ ] **Tests run** — `npm run test -- --run` passes (or failures are pre-existing with evidence)
- [ ] **New code has tests** — any new utility function, API route, or hook has a corresponding test
- [ ] **No tests removed** — no test file lines deleted without replacement or documented justification
- [ ] **No tests `.skip`'d** without an inline comment explaining why
- [ ] **Test coverage of edge cases** — empty state, error state, and loading state are tested where applicable

---

## Build & Lint

- [ ] **Build passes** — `npm run build` exits 0 (run for any change that could affect the production bundle)
- [ ] **E2e tests pass** — `npm run test:e2e` passes if a user flow was added or modified (can be marked N/A with reason)

---

## UI (if applicable)

- [ ] **Mobile layout verified** — tested at `max-w-md` container width
- [ ] **Dark mode not broken** — if the project uses dark-first design, visual check in dark mode
- [ ] **Empty state handled** — component does not crash or show blank space when data is absent
- [ ] **Error state handled** — component shows appropriate error UI, not an unhandled exception
- [ ] **Loading state handled** — component shows skeleton/spinner while data is loading
- [ ] **No console errors** in browser DevTools after the change

---

## Security & Privacy

- [ ] **No sensitive data exposed** — no PII logged, no secrets in client bundles
- [ ] **Supabase RLS respected** — no query bypasses row-level security without documented justification
- [ ] **Input validation** — any new user input is validated before use in queries or AI prompts
- [ ] **Rate limiting in place** — any new API route has rate limiting consistent with existing routes

---

## Final Summary

The implementation summary must include:

1. **What was done** — one paragraph
2. **Files changed** — exact paths with line ranges
3. **Tests run** — command + result
4. **Tests NOT run** — and why
5. **Open questions** — anything that needs a decision before the next story
6. **What was NOT done** — out-of-scope items noted for follow-up

---

## Verdict

- **PASS** — all checked items are green; task is complete
- **FAIL** — one or more items failed; list them and fix before declaring done
- **PASS WITH NOTES** — minor issues noted that don't block completion, but should be tracked as follow-up stories
