# Sprint Change Proposal – Run‑Smart (2025-11-02)

## 1. Identified Issue Summary

- The project was simplified to Dexie-only (Supabase removed) and core flows should work, but the app is reported as "not working properly" in practice. Dev server expected at port 3002; onboarding requires manual verification.
- Documentation shows conflicting snapshots about TypeScript errors and deleted routes. Evidence:
  - Dev server and Dexie-only status are reported as complete.
  - Non-blocking TypeScript errors persist across unused/advanced routes; exact count varies by document and likely by branch/state.

## 2. Evidence & Context

- Phase 1 Diagnostic Report highlights Dexie-only and onboarding flow requiring manual test.
- Phase 1 Complete Summary indicates large code cleanup and confirms Dexie-only, with remaining TS errors non-blocking and onboarding test still pending.
- PRD defines MVP scope: five screens with focus on onboarding, plan generation, today dashboard, AI chat, and run logging; analytics via PostHog.

## 3. Epic Impact Summary

- Current focus should remain on Epic 1 (Onboarding) and immediate plan visibility. Advanced epics (devices, recovery, data-fusion, analytics deep-dives) are not required to validate core MVP habit loop.
- No epic needs to be abandoned; however, advanced routes and features should be treated as backlog until core flows are verified on-device/browser.

## 4. Artifact Adjustment Needs

- Unify the Phase 1 status docs to avoid conflicting guidance. Keep `PHASE1_COMPLETE_SUMMARY.md` as source-of-truth; annotate `PHASE1_DIAGNOSTIC_REPORT.md` with a banner linking to the complete summary.
- Add a short README section for “Quick Start (Dexie-only)” with the exact steps to reset onboarding and run on port 3002.
- Record an explicit policy for non-core TypeScript errors: mark as non-blocking for dev until corresponding features are re-scoped into a sprint.

## 5. Recommended Path Forward

Recommended: Option 1 – Direct Adjustment/Integration, focusing on stabilizing the MVP path and deferring noisy, non-core errors.

- Stabilize Core Path (today):
  1) Start dev server on 3002 and run the reset onboarding page; verify onboarding → plan seeding → today screen.
  2) Ensure AI chat has graceful fallback when `OPENAI_API_KEY` is absent (already present); verify manually.

- Reduce Noise (this week):
  3) Document which API routes are considered out of scope for MVP; track their TS errors as backlog.
  4) If needed, temporarily exclude non-core test/experimental folders from type-check in CI only (not changing dev experience), while leaving strict TS in core paths.

- Align Docs & Backlog (this week):
  5) Update onboarding manual test doc to reference the Dexie-only quick start.
  6) Convert “fix TS errors in advanced routes” into discrete backlog stories grouped by epic.

## 6. High-Level Action Plan

- Day 0–1: Verify core flow
  - Run port 3002; open `reset-onboarding.html` → navigate to app → complete onboarding; confirm plan seeding (12 workouts) and transition to Today screen.
  - Capture a short GIF/screenshot for proof in `docs/implementation-reports/`.

- Day 1–2: Noise reduction
  - Enumerate non-core routes producing TS errors; tag them with epic and status.
  - Update CI to run strict type-check for core paths first; log warnings for non-core until scheduled.

- Day 2–3: Documentation alignment
  - Add README Quick Start (Dexie-only) and link Phase 1 docs.
  - Add “MVP Core Checklist” to `docs/` and tick off onboarding, plan generation, and today screen after verification.

## 7. PRD MVP Impact

- No change to MVP scope. Clarify that AI Chat must degrade gracefully (already implemented). Run Logging can be stubbed (if GPS/storage not yet wired in this web build) with a basic manual log flow to preserve the habit loop for MVP evaluation.

## 8. Agent Handoff Plan

- PM/PO: Groom stories to resolve TS errors feature-by-feature; schedule only those needed for MVP.
- Architect: Propose folder-level type-check strategy for CI that prioritizes core and logs non-core.
- QA: Create a single E2E test for onboarding → today flow; add smoke test for AI chat fallback.
- Dev: Execute stabilization steps; record verifications and update docs.

## 9. Success Criteria for This Change

- Onboarding completes and seeds plan on a fresh database, consistently.
- Today screen renders with seeded workouts after refresh.
- AI chat returns a helpful fallback without blocking flow when no API key is configured.
- CI shows “core paths type-clean”; non-core errors tracked as backlog, not blocking dev.

## 11. Execution Plan & Owners

- Dev (Today)
  - Run onboarding verification (fresh DB) per README Quick Start.
  - Capture Today screen screenshot and console logs (userId/planId, 12 workouts).
  - Store evidence in `docs/implementation-reports/` and tick `docs/MVP_CORE_CHECKLIST.md`.

- QA (This week)
  - Add a single E2E onboarding → Today smoke test.
  - Add a chat fallback smoke test (no `OPENAI_API_KEY`).

- Architect (This week)
  - Propose CI type-check scoping (core strict; non-core warn-only until scheduled).

- PM/PO (This week)
  - Create backlog items for non-core TS errors grouped by epic.

## 12. Agent Command Guide

- Scan/document current state:
  - `*task document-project`
- Guided verification and change plan (already produced):
  - `*execute-checklist change-checklist`
- Finalize plan and proceed with backlog creation:
  - `*task correct-course`
  - `*task brownfield-create-story`

## 13. Approval

Proceed with execution as outlined above. Attach onboarding verification evidence (screenshot + logs). Once attached, mark the MVP checklist complete and begin CI noise reduction stories.

## 10. Checklist Status (condensed)

- Trigger & Context: Addressed (app not working properly, friction due to TS noise and unverified onboarding)
- Epic Impact: Addressed (keep focus on Epic 1; defer advanced epics)
- Artifact Impact: Addressed (unify Phase 1 docs; add README quick start)
- Path Forward: Selected Option 1; defined steps and owners

---

Prepared by: BMad Master – Correct Course Task (YOLO mode)
Approval: Pending user confirmation

Confidence Level (CL%): 78%  
Rationale: High alignment with architecture and docs; some assumptions on current error distribution may vary by local branch/state.


