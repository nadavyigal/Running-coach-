# PR Review and Summary Workflow

Use this to prepare a PR summary or review changes before opening/pushing a PR.

## Read Only
- `AGENTS.md`
- This workflow
- Relevant spec/story
- QA report
- Changed files and git diff

## Steps
1. Inspect changed files with `git status` and `git diff`.
2. Confirm scope matches the approved spec/story.
3. Summarize product impact.
4. Summarize technical changes.
5. Include validation commands and results.
6. Include risks, rollback notes, migrations, and env changes if any.
7. Create PR summary from the template.

## Review Focus
- Behavioral regressions.
- Missing tests.
- Auth/data/security mistakes.
- Mobile UI regressions.
- Unrelated refactors or generated artifacts.
