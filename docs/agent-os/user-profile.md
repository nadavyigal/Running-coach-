# User Working Profile — Nadav (RunSmart)

> How I prefer coding agents to communicate and work. Agents should read this file to calibrate their behavior before any coding session.

---

## Communication Style

- **Be direct and practical.** No preamble, no summaries of what you're about to do. Just do it and tell me what happened.
- **Use exact file paths.** Never say "update the component file" — say `v0/components/TodayScreen.tsx:142`.
- **Paste-ready code only.** If you show code, it must be immediately usable. No pseudo-code, no `// your logic here`, no "something like this".
- **One decision at a time.** When there are architectural tradeoffs, name the options, recommend one with a clear reason, and let me decide. Don't implement without approval on significant choices.
- **Short responses for simple tasks.** If a task is a 5-line fix, don't write 500 words about it.

## Planning Expectations

- **Challenge unclear requirements before coding.** One clarifying question beats a wrong implementation. Ask it upfront.
- **Show the plan first for any task touching more than 3 files.** List files affected, what changes, and why, before writing any code.
- **Include test steps in every plan.** A plan without a test section is incomplete.
- **Include QA checks.** State explicitly how we verify the feature works end to end.
- **Identify rollback considerations.** Especially for DB migrations, API changes, or Supabase RLS policy changes.

## Change Discipline

- **Small, reviewable changes.** One story per commit where practical. Don't bundle unrelated fixes.
- **No unsolicited refactoring.** If the task is to fix a bug, fix the bug. Don't clean up surrounding code unless asked.
- **Prefer updating existing files over creating new ones.** Only create a new file if the existing structure has no appropriate home.
- **No new dependencies without asking.** Always call out when a task would require `npm install` and get approval first.
- **Leave unrelated code exactly as you found it.** A diff that touches files not in scope is a red flag.

## Testing & QA

- **Report tests run.** At the end of every implementation, list the test commands you ran and their output.
- **If you skipped a test, say why.** "No test harness exists for this component" is acceptable. Silent skipping is not.
- **Never leave the test suite red.** If a test was already failing before your change, document it explicitly before moving on.
- **Run `npm run lint` before declaring done.** Lint errors are not "just warnings" — fix them.

## Architecture Decisions

- **Explain tradeoffs explicitly.** When a choice matters (e.g., "should this state live in Dexie or Supabase?"), name the tradeoffs and recommend one path.
- **Document decisions in `docs/agent-os/project-context.md`.** When we make an architectural decision together, update the project context so future agents don't re-litigate it.
- **Prefer existing patterns.** Before introducing a new pattern (a new hook, a new API route structure), check if one already exists in the codebase and reuse it.

## What Good Looks Like

A response to a coding task should contain:
1. One-sentence statement of what was done
2. Files changed (with line ranges where significant)
3. Tests run and results
4. Anything NOT done (and why)
5. Any open questions that need my decision before the next step

## What to Avoid

- Walls of explanation before doing anything
- Code that requires manual editing before it will work
- Touching files not mentioned in the task
- Ending a response with "Let me know if you have questions!" — just ask the question
- Marking a task done when tests are failing or lint is broken
