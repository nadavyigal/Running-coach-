# Garmin Production — Remediation Plan for Marc Lussi's 2026-06-22 Review

> **Context:** We sent the Gate 1-4 evidence package on 2026-06-22 (reply to Elena Kononova,
> ticket 213145/213165). Marc Lussi (Garmin Connect Partner Services) reviewed it the same day and
> **rejected screenshots 01, 04, 05 on brand grounds** and restated the full requirement list with
> three new attachments: `Garmin_Developer_API_Brand_Guidelines.pdf`, `Brand_Requirements_Summary.jpg`,
> `Partner_UX_Review_Examples.zip`.
>
> This plan addresses **every** item in his reply. Source of truth for status: `GARMIN-STATUS.md`.
> Do **not** touch Garmin env vars / credentials until Production approval + explicit founder go-ahead.

---

## 1. What Marc rejected and why (decoded)

| Item | Marc's words | Root cause (from our screenshots) | Severity |
|---|---|---|---|
| **Shot 01** — Connect Garmin modal | "The tile indicates an ownership of/to Garmin Connect. Please use the Garmin Connect tile of the branding assets." | Our modal header pairs the **RunSmart "RS" app icon** directly with the title **"Garmin Connect"** → reads as *RunSmart owns Garmin Connect*. Must use Garmin's official Connect tile/icon, not our logo. | **BLOCKER** |
| **Shot 03** — Connected state | (not explicitly named, but identical modal) | Same RS-icon-next-to-"Garmin Connect" header. Will be rejected for the same reason if resubmitted unchanged. | **BLOCKER** |
| **Shot 04** — Report / imported runs | "Not brand compliant." | Source labelled as a bare recolored **"Garmin"** pill (RunSmart accent green). Activities attribution must follow Brand Guidelines **page 2 (Activities)** — approved wordmark/phrasing, not a recolored word. | **BLOCKER** |
| **Shot 05** — Recovery analytics | "Not brand compliant." | Screen is built entirely from Garmin wellness data (HRV 61 ms, readiness 82) with **zero Garmin attribution**. Health data must be attributed per Brand Guidelines **page 4 (Health)**. | **BLOCKER** |

**Shot 02** (Garmin SSO sign-in, `sso.garmin.com`) was **not** rejected — it is Garmin's own page, so it is compliant. Leave it.

---

## 2. The five numbered requirements in Marc's reply — status

### 1. Legal — **PASS, restate it**
- Required: direct anchor link to the Privacy Policy section describing how Garmin data is collected/used/processed/stored, **and** whether shared with third parties incl. third-party AI.
- We already have it **live**: `https://runsmart-ai.com/privacy#garmin-connect-data`
  - Verified in source `v0/app/privacy/page.tsx`: `<section id="garmin-connect-data">` describes collection, use, OpenAI as a **data processor** that does **not** train on the data, AES-256-GCM token storage, disconnect path, 30-day deletion.
- **Action:** none on the code. In the reply, give the exact anchor URL and quote the OpenAI/third-party sentence.
- **New standing rule from Marc:** *any future Privacy Policy change touching Garmin data needs Garmin's written approval before we ship it.* → Add this as a guardrail in `GARMIN-STATUS.md` and to `tasks/lessons.md`.

### 2. Technical Review — **2 gaps remain**
Requirement recap: 2+ users (✅ 7 connected), User Deregistration + User Permission endpoints enabled, PING/PUSH processing (no PULL-only), async HTTP 200 < 30s, **Training/Courses transfer screenshot**.
- ✅ Async 200 webhook deployed (`v0/app/api/devices/garmin/webhook/[token]/route.ts`).
- ✅ User Permission endpoint present (`GARMIN_PERMISSIONS_URL = .../user/permissions`).
- ✅ Deregistration handling present.
- ⚠️ **Gap A — Partner Verification "Endpoint Coverage" warns on `GC_ACTIVITY_UPDATE` + `USER_DEREG`** (no webhook receipt in 24h). Needs a *real* received ping for each: trigger one fresh activity update and one real deregistration from a connected test account, confirm the webhook logs a 200, then re-run Partner Verification so coverage goes green. Screenshot the green result.
- ⚠️ **Gap B — Training/Courses transfer screenshot is impossible as scoped.** RunSmart is **import-only** (Health + Activity). It does **not** push workouts/courses to Garmin Connect — confirmed: no Training-push code in `v0/lib/integrations/garmin/` or `v0/lib/server/garmin-endpoints.ts`. But the **portal has the Training API enabled**, so Garmin demands a transfer screenshot we cannot produce. **→ DECISION D1 below.**

### 3. Team Members & Account — **PASS, confirm in reply**
- ✅ API Blog subscribed (`nadav.yigal@runsmart-ai.com`).
- ✅ Only `nadav.yigal@runsmart-ai.com` on the account — company domain, no freemail/generic.
- ✅ No third-party integrator → **state explicitly "no third-party integrators; no NDA applicable."**

### 4. UX & Brand — **the main work** (see Section 3)
- Required: **every** instance where Garmin data appears, all trademark/logo uses, all required attribution statements (pages 2 + 4), and a **complete UX flow** — not just 5 shots.
- We currently sent 5. The app has many more Garmin surfaces (`v0/components/garmin-*.tsx`: wellness dashboard, sleep analytics, body battery, stress chart, HRV chart, readiness card, sync status bar, manual export modal). The resubmission must cover the full flow.

---

## 3. Brand/UX fixes (engineering — the blocker work)

> **Founder decisions (2026-06-22):** D1 = **build the workout-push (Training/Courses) feature** so we
> can demonstrate a transfer (see Section 7). D2 = **Claude implements the brand fixes, one story at a time.**

> **PLATFORM CORRECTION (2026-06-22):** the rejected screenshots are from the **RunSmart iOS SwiftUI
> app** (`/Users/nadavyigal/Documents/Projects /IOS RunSmart light /IOS RunSmart app`), **not** the
> Next.js web app. All brand fixes below are **Swift** edits, built in Xcode and re-captured via the
> existing Gate-4 screenshot mode (`RunSmartGate4ScreenshotMode.swift` + the capture script). The
> web `.tsx` files referenced in earlier drafts of this doc do not appear in Garmin's submission.
>
> **iOS file map:**
> - Modal (01/03): `Features/Profile/ProfileTabView.swift:307` → opens `connectedService("Garmin Connect")`; header/tile rendered in `Features/Secondary/SecondaryFlowView.swift`.
> - Report list (04): `Features/Activity/ActivityRow.swift` + `Features/Activity/ActivityTabView.swift`.
> - Recovery (05): `Features/Recovery/RecoveryDashboardView.swift`; wellness `Features/Wellness/GarminWellnessViews.swift`.
> - Garmin import/model: `Services/Garmin/GarminMappers.swift`, `GarminImportProcessor.swift`.

### Exact rules — extracted from `Garmin_Developer_API_Brand_Guidelines.pdf` (v 6.30.2025) + approved partner examples

**Authenticating an app (the Connect modal — shots 01/03):**
> "use the full app name and tile to display the connection. Do not abbreviate, truncate or stylize the Garmin app name."
- Must show the **official Garmin Connect app tile + full "Garmin Connect" name**. Our **RS icon must not** be paired with the Garmin Connect name.

**Title-level / primary displays (activity feeds, overview/summary cards — shot 04):**
> All uses of Garmin device-sourced data must include a **"Garmin [device model]"** attribution, positioned **directly beneath or adjacent to the title**, **above the fold**, visually associated with the data. **Never bury in tooltips, footnotes, or expandable containers.** If device model is unknown via the API, **list "Garmin"** as the source.
- Approved example (hashiriai Activity API): each row reads `Tue, Jun 2, 2026, 8:08 AM · Garmin Forerunner 265S` — plain text, unstylized, next to the activity title.

**Secondary screens (recovery, HR, steps, Body Battery, historical — shot 05):**
> Same "Garmin [device model]" attribution required wherever health data appears. Acceptable messaging lines (verbatim from PDF):
> - "Insights derived in part from Garmin device-sourced data."
> - "This chart was created using data provided by Garmin devices."
- Approved example (hashiriai Health API / AI coach): footer line `Insights derived in part from Garmin device-sourced data.`

**Trademark:** first use `Garmin Connect™`, `Body Battery™`, `Connect IQ™`. Do not alter/animate the Garmin tag logo; do not use it in avatars/badges or where Garmin data is absent.

**Device model:** RunSmart does **not** currently store a Garmin device model → attribution falls back to plain **"Garmin"** (PDF-allowed). Capturing the device name from the Activity API for the gold-standard "Garmin Forerunner 265" look is an **enhancement, not a blocker**.

### Fix 3.1 — Garmin Connect modal (shots 01 + 03)
- **File:** `v0/components/profile-screen.tsx` (the Profile "Garmin Connect" sheet).
- Replace the **RS app icon** in the modal header with the **official Garmin Connect app tile** + full unstylized name "Garmin Connect™". Do not pair the RS logo with the Garmin name.
- **Dependency:** the official Garmin Connect tile is **not** in `Partner_UX_Review_Examples.zip`. Get it from the Garmin Consumer Brand Style Guide (`https://creative.garmin.com/styleguide/brand/`, referenced in the PDF). **Fallback if blocked:** remove the RS icon entirely and show only the "Garmin Connect™" wordmark — compliant, since it no longer implies ownership.

### Fix 3.2 — Report source labels (shot 04) — *implementable now*
- **The specific violation:** RunSmart renders source as a **recolored accent-green "Garmin" pill**. None of the 5 Garmin-approved examples use a colored pill.
- **Approved pattern (verbatim from 4 approved examples — Hashiri Feed, Hashiri Activities, NeverDone, Hashiri detail):** attribution lives **inline in the metadata line directly under the activity title**, plain unstylized gray text, as `[timestamp] · Garmin [device model]` — e.g. `Tue, Jun 2, 2026, 8:08 AM · Garmin Forerunner 265S`.
- **Fix:** replace the green pill with `· Garmin [device model]` appended to the row's date/meta line, default text color (not brand green).
- **Device model:** not surfaced today, but the full Garmin payload is kept in `GarminNormalizedActivity.raw` → extract `deviceName` from `raw` (no migration needed). All approved examples show the model, so capture it; fall back to plain **"Garmin"** only when `raw` has no device name (PDF-allowed).

### Fix 3.3 — Recovery / wellness attribution (shot 05 + all health surfaces) — *implementable now*
- **Files:** Recovery screen + `garmin-readiness-card.tsx`, `garmin-hrv-chart.tsx`, `garmin-wellness-dashboard.tsx`, `garmin-sleep-analytics.tsx`, `garmin-body-battery-card.tsx`, `garmin-stress-chart.tsx`.
- Add a **"Garmin"** (or "Garmin [device model]") attribution **directly beneath the card heading, above the fold** — not a footnote/tooltip.
- **Approved health-attribution line (verbatim, confirmed in 2 examples — Hashiri AI Coach + mobile chat, rendered italic gray beneath the output):** `Insights derived in part from Garmin device-sourced data.` Use this on AI/derived health surfaces (Recovery insights, AI coach responses).

### Fix 3.4 — Sweep for every other Garmin surface
- Audit the Today screen, sync status bar, manual export modal, and any chart fed by Garmin data. Each needs correct naming + attribution before re-capture.

**Process for 3.1–3.4:** one component at a time (small reviewable diffs), lint + build after each, capture the new screenshot, move on. No env/credential changes.

---

## 4. Re-capture & resubmit

1. Reset the iOS simulator demo state (clean install — the prior shot-3 staleness bug was caused by `terminate` without reinstall; the capture script already patches this).
2. Re-capture the **full Garmin UX flow** (not just 5): connect entry → SSO (02, unchanged) → consent → connected modal → imported activities list → recovery/wellness cards → sleep/body-battery/stress/HRV → disconnect. Label files by API: Activities shots vs. Health shots so Marc can map them to pages 2/4.
3. Add the **Partner Verification green Endpoint Coverage** screenshot (after Gap A is cleared) and, if D1 = remove Training, a screenshot showing the portal scoped to Health + Activity only.
4. Zip as `runsmart-garmin-screenshots-ios-2026-06-23.zip` (zipped only — **no videos, no shared-folder links**, per Marc).
5. Commit screenshots + this plan; push; update `GARMIN-STATUS.md`, `tasks/progress.md`.
6. **Reply on the existing ticket** (213145/213165) from `nadav.yigal@runsmart-ai.com`, addressing each numbered item 1-4, with the corrected brand notes.

---

## 5. Decisions needed from founder

**D1 — Training/Courses API scope (blocks Gate 2 close).**
RunSmart does not push workouts to Garmin. Two options:
- **(Recommended) Remove the Training API** from the requested scope in the Developer Portal, leaving Health + Activity (import-only). Then tell Marc "RunSmart is import-only; Training/Courses API not used — removed from scope," and the transfer-screenshot requirement disappears.
- **(Not recommended now)** Build a workout-push-to-Garmin feature so we can demonstrate a transfer. This is a real new feature, weeks of work, and outside current product scope.

**D2 — Who executes the in-app brand fixes (3.1–3.4)?** These are web/React edits in the RunSmart repo. Confirm you want me to implement them as separate stories (one component per story, lint+build+screenshot each), or whether you'll hand them to a dedicated session.

---

## 6. Sequenced task list

| # | Task | Owner | Blocks |
|---|---|---|---|
| 1 | Download Marc's 3 attachments; extract official Garmin Connect tile + exact attribution wording | Founder | 3.1–3.4 |
| 2 | **D1** decide Training API scope; if remove, do it in the portal | Founder | Gate 2 close |
| 3 | Fix 3.1 modal (shots 01/03): swap RS icon → Garmin Connect tile + TM line | Eng | recapture |
| 4 | Fix 3.2 Report source pill (shot 04): approved attribution | Eng | recapture |
| 5 | Fix 3.3 Recovery + all health cards (shot 05+): add attribution | Eng | recapture |
| 6 | Fix 3.4 sweep remaining Garmin surfaces | Eng | recapture |
| 7 | Clear Gap A: trigger real activity-update + deregistration, re-run Partner Verification to green | Founder (portal) | Gate 2 close |
| 8 | Re-capture full UX flow; zip `...2026-06-23.zip` | Eng/Founder | resubmit |
| 9 | Add standing rule: privacy-policy Garmin changes need Garmin written approval (GARMIN-STATUS.md + lessons.md) | Eng | — |
| 10 | Reply on ticket 213145/213165 addressing items 1-4 + brand fixes | Founder | — |

---

---

## 7. Workout-push feature (Training/Courses API) — D1 = BUILD

> Founder chose to **build** a workout-push integration rather than drop the Training API from scope.
> This is net-new functionality and gets its **own spec + brainstorm + TDD cycle** before any code —
> it does not block the brand fixes (Sections 3-4), which can ship and resubmit first.

**Goal:** push a RunSmart-generated workout (and/or course) to the user's Garmin Connect account so a
device can execute it, then capture the "successful transfer at Garmin Connect" screenshot Marc requires.

**Open scoping questions (resolve in a brainstorm before coding):**
- Scope: structured **workouts** only, or workouts **and** courses (GPX routes)? Workouts-only is the smaller MVP that satisfies the Training API screenshot.
- Garmin Training API endpoints + payload schema (workout JSON), OAuth scopes, and whether our current Evaluation key permits Training pushes.
- UX entry point: where in RunSmart does a user "Send to Garmin" (plan day → device)?
- Mapping: RunSmart plan/workout model → Garmin workout schema (steps, targets, repeats).
- Token scope: confirm connected users granted the Training scope (may force a reconsent prompt).

**Build sequence (each its own story, TDD):**
1. Brainstorm + write spec (`docs/garmin-application/13-WORKOUT-PUSH-SPEC.md`).
2. Garmin Training API client (`v0/lib/integrations/garmin/pushWorkoutToGarmin.ts`) + unit tests.
3. RunSmart-workout → Garmin-workout mapper + tests.
4. "Send to Garmin" API route + UX entry point.
5. End-to-end: push a real workout to a test Garmin account; screenshot the transfer in Garmin Connect.

**Sequencing note:** the brand fixes are the production-access blocker and are independent. Recommend
**resubmit the brand-fixed package first** (clears 01/04/05), and deliver the Training screenshot when the
push feature lands — or tell Marc the Training feature is in active development with an ETA.

---

**Done when:** all four flagged screenshots pass brand review, full Garmin UX flow captured, Endpoint
Coverage green, Training scope resolved (workout-push transfer screenshot delivered), and the corrected
package is replied to Garmin on the existing ticket.
