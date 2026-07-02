# Agent Lessons

Reusable lessons for Claude Code, Codex, Cursor, and other agents.

## Active Lessons

### Lesson: Keep Agent OS Router Files Thin
- Trigger: Installing or updating project instructions.
- Problem: Long root instruction files waste tokens and reduce compliance.
- Future Rule: Put only routing and universal rules in `AGENTS.md`, `CLAUDE.md`, and `CODEX.md`; move detailed process into `.agent-os/`.

### Lesson: Verify Repository Root Before Acting
- Trigger: Working from parent directories with nested repos.
- Problem: Commands can run in the wrong folder and miss git/app context.
- Future Rule: Confirm the actual git repo and app directory before editing or running package commands.

### Lesson: Do Not Retry the Same Debug Fix Repeatedly
- Trigger: Recurring bug work.
- Problem: Repeating one failed fix burns time and hides root cause.
- Future Rule: After two failed attempts, widen investigation with logs, tests, browser evidence, or config checks.

### Lesson: Supabase `.single()` Can Cause False Errors
- Trigger: Supabase lookup returns 406 or no rows.
- Problem: `.single()` errors on zero or multiple rows.
- Future Rule: Use `.maybeSingle()` unless exactly one row is guaranteed and an error is desired.

### Lesson: UI Changes Need Visual Evidence
- Trigger: Redesigns, layout changes, responsive fixes.
- Problem: Code can pass while mobile layout regresses.
- Future Rule: For UI changes, run a browser/mobile viewport check and capture screenshot or clear visual notes.

### Lesson: Save Approved Specs Before Implementation
- Trigger: Starting implementation when the approved spec only exists in chat history.
- Problem: Agents have to reconstruct scope, which increases ambiguity and risk.
- Future Rule: Before implementing a feature story, save the approved spec in `docs/specs/` or explicitly name the spec source in `tasks/todo.md`.

### Lesson: Smoke New Test Files Before Moving On
- Trigger: Adding a new focused test file.
- Problem: A missing closing delimiter in a new test file can hide behind otherwise-passing neighboring suites until the full command runs.
- Future Rule: After creating a new test file, run that exact file once before treating broader validation as meaningful.

## Lesson Template
Use `.agent-os/templates/lesson-template.md` for new entries.
