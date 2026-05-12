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

## Lesson Template
Use `.agent-os/templates/lesson-template.md` for new entries.
