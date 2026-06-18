# Garmin Branch Push + Repo Cleanup — 2026-06-18

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute task-by-task.

**Repo:** `/Users/nadavyigal/Documents/RunSmart`

**Goal:** Push the unpushed Garmin evidence commit, commit the 4 uncommitted files, add the 2 untracked plan docs, and open a PR for `fix/garmin-ios-branch-fixes`.

**Context:**
- Current branch is `main`. 4 files are modified: `v0/package.json`, `v0/vitest.config.ts` (likely a vitest/package config bump from the CI shard work), plus 2 untracked Garmin plan docs.
- `fix/garmin-ios-branch-fixes` is a separate branch with 1 unpushed commit (`5dd5515 docs: add Garmin Gate 1-4 evidence package work pack`). It needs a PR opened.
- The Today page redesign (Story 1) is the next feature task — but do not start it until the hygiene above is done.

---

## Task 1: Commit v0 config changes + untracked plan docs on main (10 min)

- [ ] Review the 4 pending changes:
  ```bash
  cd /Users/nadavyigal/Documents/RunSmart
  git diff HEAD -- v0/package.json v0/vitest.config.ts
  ```
  Confirm this is the vitest shard count config bump (not an unintended change).

- [ ] Stage and commit the v0 config files:
  ```bash
  git add v0/package.json v0/vitest.config.ts
  git commit -m "chore(ci): commit vitest config bump from CI shard work"
  ```

- [ ] Stage and commit the 2 untracked Garmin plan docs:
  ```bash
  git add docs/superpowers/plans/2026-06-15-garmin-evaluation-fixes.md \
    docs/superpowers/plans/2026-06-15-garmin-production-enablement.md
  git commit -m "docs(garmin): add garmin evaluation-fixes and production-enablement plan docs"
  ```

- [ ] Push main:
  ```bash
  git push origin main
  ```

- [ ] Confirm:
  ```bash
  git status --short --branch
  ```
  Expected: `## main...origin/main` clean.

---

## Task 2: Push fix/garmin-ios-branch-fixes and open a PR (10 min)

The branch has 1 unpushed commit containing the Garmin Gate 1-4 evidence package.

- [ ] Switch to the branch:
  ```bash
  git checkout fix/garmin-ios-branch-fixes
  ```

- [ ] Confirm the 1 unpushed commit:
  ```bash
  git log --oneline @{u}.. 2>/dev/null || git log --oneline origin/main..HEAD
  ```
  Expected: `5dd5515 docs: add Garmin Gate 1-4 evidence package work pack`

- [ ] Push:
  ```bash
  git push origin fix/garmin-ios-branch-fixes
  ```

- [ ] Open a PR:
  ```bash
  gh pr create \
    --base main \
    --head fix/garmin-ios-branch-fixes \
    --title "docs(garmin): add Gate 1-4 evidence package work pack" \
    --body "$(cat <<'EOF'
## Summary
- Adds the Garmin Gate 1-4 evidence package work pack doc.
- Part of the Garmin Production Roadmap milestone tracking.

## Test plan
- [ ] Review the work pack doc for accuracy against current Garmin production state.
- [ ] No code changes — docs only.
EOF
)"
  ```

- [ ] Capture the PR URL from the output and paste it into `tasks/todo.md` or `tasks/progress.md` for tracking.

- [ ] Switch back to main:
  ```bash
  git checkout main
  ```

---

## Task 3: Merge the PR (5 min, after review)

Once the PR is open and you've reviewed the doc:

- [ ] Merge via GitHub UI or:
  ```bash
  gh pr merge fix/garmin-ios-branch-fixes --squash --delete-branch
  ```

- [ ] Pull main to stay in sync:
  ```bash
  git pull origin main
  ```

---

## Task 4: Stub Story 1 in tasks/todo.md (5 min)

The Today page redesign Story 1 is approved but not started. Log the exact next action so the next session picks it up cold.

- [ ] Open `tasks/todo.md` and add under the Current Task section:
  ```
  ## Next Session — Story 1: Today Content Inventory + Preservation Map

  Spec: docs/specs/2026-05-12-today-command-center.md (read this first)

  Objective: Before any Today redesign, produce a complete inventory of what the current Today page renders,
  where each data element comes from, and which elements must be preserved in the redesign.

  Deliverable: A markdown table in tasks/today-content-inventory.md listing:
  - Component name
  - Data source (API route, Supabase table, or computed)
  - Whether it is required in the new design or can be dropped
  - Any known dependencies or side effects

  Estimated time: 45-60 min session.
  ```

- [ ] Commit:
  ```bash
  git add tasks/todo.md
  git commit -m "docs: stub Story 1 today-content-inventory next action"
  git push origin main
  ```

---

## Done criteria
- [ ] `v0/package.json` and `v0/vitest.config.ts` committed and pushed on main
- [ ] 2 Garmin plan docs committed and pushed
- [ ] `fix/garmin-ios-branch-fixes` pushed and PR open
- [ ] PR merged and main pulled
- [ ] Story 1 next-session stub in tasks/todo.md
