# QA Review Workflow

Use this before declaring a story, feature, or release ready.

## Read Only
- `AGENTS.md`
- `CLAUDE.md` or `CODEX.md`
- `tasks/lessons.md`
- This workflow
- `docs/qa/qa-checklist.md`
- Relevant spec/story and changed files

## Steps
1. List what changed and what should not have changed.
2. Map changes to acceptance criteria.
3. Select automated checks from `docs/qa/qa-checklist.md`.
4. Run focused tests first, then broader gates if risk warrants.
5. For UI changes, inspect mobile viewport and capture visual evidence.
6. Check auth, Supabase, AI, and deployment concerns only if touched.
7. Create a QA report using the template.
8. Add lessons for missed requirements, failed tests, or confusing output.

## Output
- Pass/fail status.
- Commands and manual checks run.
- Bugs found and severity.
- Residual risks.
- Recommendation: ready, ready with caveats, or not ready.
