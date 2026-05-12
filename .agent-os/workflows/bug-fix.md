# Bug Fix Workflow

Use this for defects, regressions, broken tests, and production issues.

## Read Only
- `AGENTS.md`
- `CLAUDE.md` or `CODEX.md`
- `tasks/lessons.md`
- This workflow
- Relevant error output, logs, tests, and code

## Steps
1. Reproduce or precisely describe the bug.
2. Check `tasks/lessons.md` for matching recurring issues.
3. Identify expected vs actual behavior.
4. Find the smallest failing test or manual reproduction.
5. Fix the root cause, not only the symptom.
6. Run focused validation.
7. Run adjacent regression checks based on risk.
8. Update `tasks/lessons.md` if the bug teaches a reusable rule.
9. Update `tasks/todo.md` if this is part of a larger task.

## Debugging Rules
- Do not retry the same fix more than twice.
- Use browser console/Playwright for UI runtime bugs.
- Use Supabase logs/config for auth/data bugs.
- Use Vercel logs/build output for deploy bugs.
- Record what evidence proved the fix.
