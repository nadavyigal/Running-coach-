# Garmin Official Requirements vs. Marc/Portal Notes — Research Pass (2026-07-06)

Codex session, no deep-research skill installed — manual sourced pass instead. Local Context Read: WP-24 through WP-28 (Agentic OS `executive-os/work-packets/`), the web/iOS Gate-4 rejection history, `GARMIN-STATUS.md`.

## Bottom line

Our current understanding is strongest on **brand attribution** and the **Internal Test vs. Commercial split**. It is weakest on the exact certification checklist, the 30-day historical-data rule, and "no fees" — those are either Marc/portal-thread grounded only, or partly contradicted by public Garmin docs.

**The fees claim is the clearest contradiction and the highest-priority item to resolve before any further Garmin relaunch spend.**

## Local anchors read

- Marc's July 1 "Evaluation apps are not allowed to connect external users" note — WP-24, line 15.
- Paused Internal Test/Commercial packet — WP-26, line 47.
- Evidence pack — WP-27, line 40.
- Three-rejection trail — `GARMIN-STATUS.md`, line 127.

## Requirement-by-requirement findings

| Area | Public Garmin docs say | Matches Marc? |
|---|---|---|
| **OAuth / app tiering** | All Developer Program APIs use OAuth 2.0; approved developers get an evaluation environment for testing (Garmin FAQ, Activity/Health pages). | Matches on OAuth 2.0 + scope. Marc's specific "Evaluation apps cannot connect external users" wording isn't in Garmin's own public docs — but Open Wearables (third party) independently describes Evaluation apps as internal-development-only and warns commercial Evaluation use may be disabled. **Grounding: partial (third-party corroboration, not official).** |
| **Commercial certification checklist** (Gate 1-4, Privacy/OpenAI, Partner Verification, Data Generator, USER_DEREG, 2+ users, API Blog signup, team-email hygiene) | Public pages mention developer tools for "sample data, backfill user data, auto-verification... before production" but no public Gate 1-4 checklist naming any of the above items. | **Mostly not publicly grounded.** The entire gate checklist we've built our process around rests on Marc/portal-thread guidance with no independent public confirmation. |
| **Connect flow branding** | Official API guidelines require the full Garmin app name plus tile when authenticating/connecting — no abbreviation, truncation, or stylization. Brand docs require official imagery, unaltered. | **Matches** — consistent with the tile/full-name rejections already hit. |
| **Device attribution** | Official guidelines require "Garmin [device model]" at title-level and on secondary Garmin-data displays; "Garmin" alone allowed if model unknown; must be adjacent/above-fold, not buried. | **Matches** — consistent with the June 26 device-model rejection. |
| **Derived / AI use** | Official guidelines require Garmin attribution when Garmin data materially influences analytics/algorithms/ML/AI/blended outputs. Agreement also references AI transparency compliance. | **Matches** Marc's "AI coaching allowed, disclose/attribute" direction. The specific "OpenAI disclosure" wording is Marc-thread only, not public Garmin language. |
| **"Garmin Wellness" ban** | No public rule specifically forbidding the name "Garmin Wellness." Public rules do support the underlying logic indirectly (don't stylize Garmin app names, don't mislead about origin/capability). | **Marc-specific**, generally supported but not explicitly public. |
| **Data use / privacy** | Agreement requires conspicuous privacy notice, consent, easy withdrawal, data-subject rights handling, no selling personal data without lawful consent, no Garmin credential collection, security controls, 24-hour breach/security-weakness notice. | **Matches/extends** Gate 1 privacy requirements already built. |
| **Retention / historical data** | Agreement says retention after cross-border transfer lasts while the user maintains an account or until deletion rights are exercised — no official "30 days max" language. Open Wearables (third party) describes 30 days as a Garmin *backfill* limit, not official Garmin documentation. | **Not publicly grounded.** |
| **Fees** | Agreement: no license fees under that agreement, but reserves future fees and excess-volume fees. Public FAQ: some metrics may require license fees/minimum device-order quantity. Health API page: commercial use requires a license fee payment. | **Clearest contradiction.** Marc/local notes say "NO fees" as if universal. Public docs contradict that as a blanket claim — it may only hold as a RunSmart-specific answer from Marc, not a general Garmin policy. **Do not treat "no fees" as settled before the next commercial-tier spend.** |

## Publicly documented failure patterns

- Garmin can decline/suspend a key if requirements are unmet; branding noncompliance can lead to data reduction then suspension/termination; attribution noncompliance may suspend API access (Agreement).
- Public forum evidence: access requests have failed/stalled over privacy-policy placement (one report: rejected because the privacy policy was on the app page rather than the business page) and unclear rejection reasons.
- Third-party/postmortem evidence (Strava-adjacent) confirms Garmin attribution enforcement is current and ecosystem-wide; text "Garmin [device model]" attribution is mandatory, the logo itself is optional in many data-display contexts.

## Recommended next step

Before resuming any Garmin Commercial-tier work (WP-24/26/27/28, currently paused per EXD-015): get Marc (or Garmin directly) to confirm or correct the two weakest-grounded claims — the exact certification checklist and, especially, the fee structure — in writing. A fourth rejection or an unexpected fee bill is a worse outcome than the time cost of asking first.
