# Product Requirements Document – Run‑Smart MVP (v 1.0)

> Prepared by: PM Agent · Date: 2025‑07‑07

---

## 1 · Objective
Deliver a **5‑screen mobile MVP** that proves Run‑Smart can:
1. Build a sustainable running habit for novices.
2. Showcase the value of adaptive AI coaching.
3. Achieve ≥40 % Day‑30 retention with ≥55 % weekly plan‑completion.
4. Gather baseline monetisation data (conversion experiment ready, paywall disabled).

## 2 · Background & Opportunity
Recreational runners lack affordable, tailored coaching. Existing apps skew toward social competition. Run‑Smart focuses on **intrinsic motivation**—personal milestones, adaptive plans, and habit science.

## 3 · Problem Statements
- Novice runners abandon plans after 1–2 weeks due to unclear guidance and injury fear.
- Existing apps overwhelm users with data or social pressure.
- Habit formation requires consistent cues and quick feedback loops.

## 4 · Success Metrics (North‑Star & Guardrail)
| Metric                         | Target   | Source                                                            |
| ------------------------------ | -------- | ----------------------------------------------------------------- |
| Weekly Plan‑Completion (W1→W4) | ≥ 55 %   | PostHog event `plan_session_completed` / `plan_session_scheduled` |
| Day‑30 Retention               | ≥ 40 %   | PostHog cohort retention                                          |
| Avg. Daily Active Minutes      | ≥ 12 min | PostHog `$active_time`                                            |
| Crash‑free Sessions            | ≥ 99.6 % | Sentry                                                            |

## 5 · Scope (MVP)
### In
- **Five Screens** – Today Dashboard, Plan Overview, Record Run, AI Coach Chat, Runner Onboarding.
- **Core Services** – Auth, Plan Generation, Run Logging, Adaptive Coaching, Chat Coach (OpenAI GPT‑4o), Route Explorer β.
- **21‑Day Rookie Challenge** seeded at onboarding.
- **Analytics** – **PostHog** cloud, autocapture + custom events.
- **Privacy Compliance** – GDPR & US‑CHD delete/export.

### Out (Backlog)
- Stripe paywall, BLE sensors, community feed, wearables.

## 6 · User Personas & JTBD
| Persona                    | Key JTBD                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| **Morning‑Routine Rookie** | “Help me start & stick to a simple morning run without overthinking.” |
| **Self‑Improver Striver**  | “Guide me to beat my 10  K PB while avoiding injury and boredom.”      |

## 7 · Assumptions & Constraints
- Mobile: bare React Native, dark‑first design.
- LLM: OpenAI GPT‑4o, token budget of $50/mo (<5 k MAU).
- Team velocity: **24 story points / 2‑week sprint** (see §12).
- Beta cohort: **100 runners** (70 EN, 30 HE) recruited via local clubs & Instagram ads.

## 8 · Detailed Requirements
### 8.1 Functional
1. **Onboarding (ONB‑001)** – 5‑step wizard capturing goals, availability, RPE slider (optional), GDPR consent.
2. **Plan Generation (PGN‑001)** – Create 14‑day plan & flag `rookie_challenge=true`.
3. **Today Dashboard (TDB‑001)** – Display today’s session/rest, Record / Add Activity CTAs.
4. **Record Run (RUN‑001)** – GPS tracking with pause/resume; save `gpx` blob to S3 & summary to DB.
5. **Adaptive Adjust (ADA‑001)** – Recompute future sessions nightly & after run.
6. **AI Chat (CHT‑001)** – GPT reply ≤ 1.5 s p95 using profile + last 3 runs as context.
7. **Route Explorer (RTE‑001)** – Return 3 nearby routes matching distance & elevation.
8. **Habit Reminders (HAB‑001)** – Push at user‑set cue time; snooze/disable.

### 8.2 Non‑Functional
- **Performance** – App cold start < 1.5 s; map FPS ≥ 50.
- **Reliability** – 99.9 % uptime; graceful degrade if OpenAI timeout.
- **Security** – OWASP MASVS L1; health data encrypted at rest (KMS).
- **Accessibility** – WCAG AA, colour‑blind palette switch.

### 8.3 UI Audit Findings & Recommendations (2025-07-07)
A UI audit of the V0 MVP main screens (Today, Plan, Profile, Record, Chat) was conducted. The following mismatches and recommendations were identified:

| Area            | Issue/Observation                                                                 | Severity   | Recommendation                                  |
|-----------------|-----------------------------------------------------------------------------------|------------|-------------------------------------------------|
| Accessibility   | No explicit ARIA attributes or keyboard navigation for modals/buttons.             | Medium     | Add ARIA roles/labels, ensure tab order.         |
| Contrast        | Some secondary text uses `text-gray-500`/`600` on white, which may fail WCAG AA.   | Low-Med    | Check contrast, consider darker grays.           |
| Feedback        | Error toasts are present, but no success feedback for actions (e.g., add run).     | Low        | Add positive feedback for successful actions.    |
| Responsiveness  | Layout uses flex/grid, but no explicit mobile breakpoints in these files.          | Low        | Confirm mobile responsiveness in CSS.            |
| Modals          | Modal focus trapping and escape-to-close not shown in these files.                 | Medium     | Ensure modal primitives handle this.             |
| Icon Usage      | Icons used for context, but no alt text for screen readers.                        | Low        | Add `aria-label` or visually hidden text.        |
| Loading States  | Loading spinners for data, but not for all async actions (e.g., form submits).     | Low        | Add loading indicators for all async ops.        |

**Next Steps:**
- Review modal and navigation components for accessibility and interaction patterns.
- Check UI primitives for built-in accessibility and focus management.
- Review mobile responsiveness in CSS and layout files.
- Address above recommendations in upcoming sprints.

## 9 · User Flows
1. **Happy Path Onboarding → First Run:** splash → onboard → today → record run → save → adaptive plan update.
2. **Ask Coach:** today → chat → ask “Should I rest tomorrow?” → suggestion chip tap → reply.
3. **Import Activity:** today → add activity → Strava import → plan recalculated.

## 10 · Analytics Instrumentation (PostHog)
| Event                    | Properties                     | Trigger       |
| ------------------------ | ------------------------------ | ------------- |
| `onboard_complete`       | age, goalDist, rookieChallenge | Finish wizard |
| `plan_session_completed` | sessionId, type, distance      | Save run      |
| `chat_message_sent`      | tokensIn, tokensOut            | On send       |
| `route_selected`         | routeId, distance              | Start nav     |
| `reminder_clicked`       | sessionId                      | Push open     |

## 11 · Release Criteria
- All acceptance criteria (§13 of Brief) met & QA pass.
- North‑Star leading indicators trending ≥90 % of targets in beta.
- Zero P1 bugs open; crash‑free ≥99.6 % in TestFlight.
- Privacy & store compliance checklists signed.

## 12 · Team & Capacity
| Role          | Name | Pct allocation | SP / sprint |
| ------------- | ---- | -------------- | ----------- |
| Mobile Dev 1  | TBA  | 60 %           | 6           |
| Mobile Dev 2  | TBA  | 60 %           | 6           |
| Backend Dev 1 | TBA  | 60 %           | 6           |
| AI / Chat Eng | TBA  | 50 %           | 4           |
| QA Eng        | TBA  | 40 %           | 2           |
| **Velocity**  | —    | —              | **24 SP**   |

## 13 · Timeline (10 Sprints)
See §9 Roadmap in Project Brief; unchanged.

## 14 · Risks & Mitigations (Delta)
| Risk                              | Mitigation                                                      |
| --------------------------------- | --------------------------------------------------------------- |
| Beta cohort too small for metrics | Run Instagram ad blast with $300 budget to recruit 200 extras.  |
| Team velocity variance            | Buffer 20 % of SP each sprint; use stretch backlog.             |

## 15 · Open Issues
- Confirm AWS budget alert thresholds.
- Finalise colour‑blind palette before Sprint 2.

---

*End of PRD v 1.0 – subject to change via Change‑Control log.* 