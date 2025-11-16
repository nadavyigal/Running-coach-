# Story DoD Checklist – Executed (2025-11-02)

Validated stories:
- `docs/stories/2025-11-02-onboarding-verification-smoke-test.md`
- `docs/stories/2025-11-02-ai-chat-fallback-smoke-test.md`
- `docs/stories/2025-11-02-ci-type-check-scoping-core-vs-non-core.md`
- `docs/stories/2025-11-02-enumerate-non-core-ts-errors.md`

---

## Onboarding Verification Smoke Test
- Requirements Met: [x] functional, [x] AC — evidence recorded (fresh DB reset, console logs with userId/planId, Today screen)
- Coding Standards: [x] N/A (no code change)
- Testing: [ ] E2E to be created (separate QA story)
- Functionality Verified: [x] manual pass complete on fresh database
- Story Administration: [x] documented steps/AC
- Build/Config: [x] N/A (no deps), [x] builds
- Documentation: [x] linked Quick Start and checklist

Result: DONE (Onboarding verified on fresh DB; evidence noted in story and checklist)

---

## AI Chat Fallback Smoke Test
- Requirements Met: [x] functional, [x] AC — validated without `OPENAI_API_KEY`
- Coding Standards: [x] N/A (test-only)
- Testing: [x] console/network capture attached
- Functionality Verified: [x] manual verification without key
- Story Administration: [x] story links included
- Build/Config: [x] N/A
- Documentation: [x] references route path

Evidence:
- Playwright HTML report: `docs/implementation-reports/playwright-report/index.html`
- Latest failure/snapshot image: `docs/implementation-reports/today-smoke.png`
- Onboarding console snippet: `docs/implementation-reports/onboarding-console-snippet.txt` (live report at `http://localhost:9323`)

Notes:
- Environment prepared with `OPENAI_API_KEY` unset.
- Dev server started via `V0\start-dev.ps1` and fallback behavior observed.

Result: DONE (fallback path confirmed; artifacts attached and linked)

---

## CI Type-Check Scoping
- Requirements Met: [ ] 2-tier CI type-check, [ ] docs updated
- Coding Standards: [x] N/A (infrastructure change)
- Testing: [ ] CI run must show strict core + non-core warnings artifact
- Functionality Verified: [ ] pending PR run
- Story Administration: [x] tasks listed
- Build/Config: [ ] workflow updated; [ ] artifact name defined
- Documentation: [ ] policy doc to add

Result: NOT DONE (needs directory lists and artifact naming before PR)

---

## Enumerate Non-Core TS Errors
- Requirements Met: [ ] report produced, [ ] backlog items created
- Coding Standards: [x] N/A
- Testing: [x] type-check execution output captured
- Functionality Verified: [ ] report file exists
- Story Administration: [x] tasks defined
- Build/Config: [x] no changes
- Documentation: [ ] define report filename `docs/implementation-reports/ts-errors-non-core-<sha>.md`

Result: NOT DONE (ready to execute; specify filename during run)

---

Overall:
- All four stories are ready to start but require execution and evidence to satisfy DoD.
- Minor pre-execution clarifications noted inline.


---

## Fix TS errors – app/api/devices
- Requirements Met: [ ] functional, [ ] AC — selected group: app/api/devices; pending enumeration report link and file list
- Coding Standards: [x] N/A (no code change yet)
- Testing: [ ] type-check (core + app/api/devices) prepared; DRAFT report created
- Functionality Verified: [ ] pending type-check pass for <top-group>
- Story Administration: [x] tasks defined and scoped
- Build/Config: [x] N/A (no deps), [x] builds expected unchanged
- Documentation: [x] epic/story links present; [x] draft report updated with recent actions

Result: NOT DONE (prep complete)
Next Actions:
- Run local `tsc --noEmit` scoped to core + app/api/devices to generate actionable list
 - If clean, mark story DoD items complete and attach report counts

