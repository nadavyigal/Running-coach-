# Story Implementation Workflow

Use this for implementing one approved story at a time.

## Read Only
- `AGENTS.md`
- `CLAUDE.md` or `CODEX.md`
- `tasks/lessons.md`
- `tasks/todo.md`
- This workflow
- Approved feature spec/story
- Relevant code/tests

## Steps
1. Confirm the story, acceptance criteria, out-of-scope items, and validation plan.
2. Update `tasks/todo.md` with current story status.
3. Inspect the smallest relevant code surface.
4. Add or update focused tests first when practical.
5. Implement the minimum change.
6. Run focused validation.
7. Run broader gates based on risk.
8. Update `tasks/todo.md` with progress, validation, and review notes.
9. Add a lesson if a mistake, failed assumption, or reusable issue occurred.

## Done Means
- Acceptance criteria are met.
- Relevant validation was run or explicitly skipped with reason.
- No unrelated app behavior changed.
- Task memory reflects the final state.

## Do Not
- Start multiple stories at once.
- Refactor unrelated areas.
- Change schema without migration and rollback notes.
- Claim completion without verification.
