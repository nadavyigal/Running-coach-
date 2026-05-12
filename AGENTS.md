# RunSmart Agent Router

This repo uses a thin Agent OS. Do not load every OS file. Read this file first, then route to only the files needed for the task.

## Always Start
- Work in the repo root, but run app commands from `v0/`.
- Read `tasks/lessons.md` before planning, implementation, bug fixing, QA, or PR work.
- Check `tasks/todo.md` for current task state before changing files.
- Preserve app behavior unless the requested task explicitly changes it.
- Verify before saying done. Record what passed, failed, or was not run.

## Workflow Route
- Planning: read `tasks/lessons.md`, `.agent-os/workflows/feature-planning.md`, `docs/product/current-product-state.md`, and relevant templates.
- Implementation: read `tasks/lessons.md`, `tasks/todo.md`, `.agent-os/workflows/story-implementation.md`, approved spec/story, and relevant code.
- Bug fix: read `tasks/lessons.md`, `.agent-os/workflows/bug-fix.md`, relevant errors/logs/files.
- QA: read `tasks/lessons.md`, `.agent-os/workflows/qa-review.md`, `docs/qa/qa-checklist.md`.
- PR summary: read `.agent-os/workflows/pr-review.md`, relevant spec, QA report, and changed files.

## Required Flow
Idea -> Product Brief -> Feature Spec -> Development Stories -> Implementation Plan -> Tests / Validation -> QA Report -> PR Summary -> Lessons Update.

## Self-Improvement Rule
After a user correction, failed implementation, bad assumption, broken test, repeated mistake, confusing output, overengineering, or missed requirement, add a short lesson to `tasks/lessons.md` with a practical future rule.

## Verification Rule
Minimum gate for app changes is usually `npm run lint`, `npm run type-check`, and relevant tests from `v0/`. For UI changes, add a mobile viewport/manual visual check. If a check cannot run, say why.

## Examples
- "Plan the Garmin readiness feature using the Agent OS."
- "Implement story 1 from `docs/specs/<feature>.md` only."
- "Review the Today page UI against RunSmart standards."
- "Fix this Supabase 406 bug and update lessons if reusable."
- "Create a QA report for the latest profile changes."
- "Prepare a PR summary from the spec and QA report."
