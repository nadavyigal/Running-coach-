# Product Marketing Context

*Last updated: 2026-06-20*
*Assembled from: `Agentic OS/distribution-os/projects/runsmart/scaffold/{product-positioning,audience,messaging,competitors,metrics}.md` (synced 2026-05-24/27). Update there first, then re-sync here.*

## Product Overview
**One-liner:** The AI running coach for beginners and returning runners who need safe daily adaptation — not just faster race plans.
**What it does:** RunSmart is a native iOS AI running coach that gives accurate, personalized daily guidance, shows progress week over week, and adapts plans so users don't get injured chasing a plan that wasn't built for their body.
**Product category:** AI running coach. Adjacent: training plan apps, coach-on-demand, run analysis tools.
**Product type:** iOS app (Capacitor), free at v1.0, paid tier not yet shipped.
**Business model:** Free at v1.0; revenue metrics not yet activated (`runsmart.revenue.mrr` tracked as "not tracked, v1.0 is free").

## Target Audience
**Target companies:** N/A — consumer (B2C) app.
**Decision-makers:** N/A — single end-user purchase decision.
**Primary use case:** Daily answer to "what should I run today, and is my body ready" — without forcing the user to interpret raw fitness data.
**Jobs to be done:**
- When I wake up, I want to know if I should run and at what effort — in plain language — so I can decide in 30 seconds.
- When my plan says something that feels wrong for my body today, I want RunSmart to explain why it's right (or adapt it), not force a choice between the plan and my instincts.
- When I finish a workout, I want to see it contributed to something (streak, milestone, coach reaction) so progress feels real.
- When I'm tired or sore, I want RunSmart to catch it before I do and hold me back with a reason I believe.
**Use cases:**
- New/returning runner training for a first 5K, 10K, half, or full marathon
- Intermediate runner with a Garmin/Apple Watch who churned from Runna because the plan didn't adapt to real life

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| The Rookie (28-45) | Not getting injured, feeling like the plan "knows me" | Tried NRC or a free PDF plan, got injured or lost motivation by week 3 | A plan calibrated to actual fitness, with visible proof of improvement and safety confidence |
| The Striver (25-40, wearable) | Making Garmin/Apple Watch data actionable, not just a dashboard | Churned from Runna because manual plan-dragging didn't keep up with life disruptions | An intelligence layer on top of wearable data that adapts automatically and explains the "why" |

## Problems & Pain Points
**Core problem:** Runners don't know if a plan is actually calibrated to their fitness, and rigid plans lead to injury or lost motivation by week 3.
**Why alternatives fall short:**
- Free PDFs / Couch to 5K: zero personalization or adaptation
- Runna: polished, but the plan doesn't adapt when life gets in the way; users manually drag sessions
- Generic ChatGPT prompting: no structure, no readiness signal, no continuity
**What it costs them:** Injury, lost motivation, wasted training blocks, second-guessing every missed session.
**Emotional tension:** Doubt about whether a missed session means failure; fear of re-injury; distrust of generic "AI-powered" claims in a now-crowded category.

## Competitive Landscape
**Direct:** Runna — strong brand (735K followers), polished UX, Strava bundle at $149.99/yr — falls short because the plan doesn't adapt to actual life disruption and is bundle-locked to Strava.
**Secondary:** TrainingPeaks — power-user depth, coach ecosystem — falls short for this audience because it requires data literacy beginners don't have.
**Indirect:** Nike Run Club (free, brand recognition) and generic ChatGPT coaching — fall short on personalization depth and Garmin/Apple integration.
**Also tracked (category now crowded, not direct battlecard targets):** Kotcha (elite-positioned), KASI (audio coaching), URUNN (elite + audio), Strava Athlete Intelligence, Garmin Connect+, Apple Workout Buddy.

**When RunSmart wins:** runner injured/overloaded by a rigid plan; beginner wants daily readiness-aware guidance; busy life needs conversational flexibility over manual plan-dragging; runner values "why" explanations; churned from Runna and not locked into Strava bundle pricing.
**When Runna wins:** user already pays for Strava (frictionless bundle upsell); wants Olympian-credentialed plan library; needs ultra/marathon-specific depth; needs Android or non-Apple wearable support today; has brand awareness RunSmart doesn't yet have.

## Differentiation
**Key differentiators:**
- Adaptive plan generation that responds to actual completed sessions, not a fixed weekly grid
- Post-run debrief in plain language
- Readiness check tied to recovery (safety-first defaults — the 10% rule and readiness gate)
- Race strategy delivered at the right moments
- Garmin / Apple Health integrations that turn data into decisions, not dashboards
- Conversational coaching that explains the "why" behind every recommendation
**How we do it differently:** Daily adaptation driven by a readiness signal, not a static schedule revised weekly.
**Why that's better:** Reduces injury risk and the "is this plan even right for me" doubt that causes week-3 dropoff.
**Why customers choose us:** Earned trust — personalization accuracy + visible progress + safety confidence, simultaneously.

## Objections
| Objection | Response |
|-----------|----------|
| "Isn't this just another AI-powered running app?" | Don't lead with "AI-powered" — it's true but generic in a crowded field (Kotcha, KASI, URUNN, Strava AI, Garmin Connect+, Apple Workout Buddy). Lead with readiness-first daily adaptation instead. |
| "Runna already does this and has more brand trust" | Runna delivers a schedule; RunSmart delivers a coach that reads your body every morning. Do not claim Runna "has no AI" or "is unsafe" — use the softer "some users report overload following plans rigidly" framing. |
| "I don't have a wearable" | The Rookie segment needs no wearable or wearable data — readiness logic still works from in-app inputs. |

**Anti-persona:** Elite/sub-elite athletes (need a human coach), pure walkers, Android users (out of scope for 2026), users wanting a pure social fitness app.

## Switching Dynamics
**Push:** Got injured or lost motivation on a rigid plan; manual plan-dragging in Runna stopped keeping up with life.
**Pull:** A coach that adapts daily and explains the "why," not just a schedule.
**Habit:** Sunk cost in an existing plan/app; Strava bundle lock-in for Runna users.
**Anxiety:** Will a new app actually be safer, or just another generic AI wrapper claiming the same thing?

## Customer Language
**How they describe the problem:** "training plan," "couch to 5K," "first race," "should I do this run," "easy run pace," "beginner running plan" (Rookie) — "adaptive plan," "RPE," "deload," "marathon plan," "Garmin training," "Strava analysis," "HRV" (Striver).
**How they describe us:** Not yet captured — no user quotes logged. *(Gap: capture 2-3 verbatim quotes from App Store reviews or user interviews and add here.)*
**Words to use:** "adaptive," "readiness," "coach," "earned trust," "real-life consistency."
**Words to avoid:** "Revolutionary," "AI-powered" as the headline, "Marathon in 12 weeks" without context, "Replaces your coach," "Runna is unsafe."
**Glossary:**
| Term | Meaning |
|------|---------|
| Readiness check | Recovery-based gate that decides whether to push or hold back a session |
| Debrief | Plain-language post-run summary |
| 10% rule | Conservative weekly load-increase cap, framed as a safety feature not a limitation |

## Brand Voice
**Tone:** Direct, honest, encouraging without being sappy.
**Style:** Conversational coaching language; explains "why," not just "what."
**Personality:** Trustworthy, calm, safety-first, capable-adult-respecting, anti-hype.

## Proof Points
**Metrics:** None tracked yet — `runsmart.retention.d7`/`d14` are the north star metrics but tracking status is "not tracked" pending PostHog event instrumentation (rs-analytics-001).
**Customers:** None named yet.
**Testimonials:** None captured yet. *(Gap: pull from App Store reviews once available.)*
**Value themes:**
| Theme | Proof |
|-------|-------|
| Safety-first | 10% rule + readiness gate are core product behavior, not fine print |
| Adaptive, not static | Plan regenerates from actual completed sessions |

## Goals
**Business goal:** Hit D7 retention gate (target date 2026-06-24); grow weekly active runners from a churned-Runna acquisition wedge.
**Conversion action:** First AI training plan generated within the first session (`plan_generated` event); first run logged (`run_logged` event).
**Current metrics:** Not yet tracked — `app_opened`, `onboarding_completed`, `plan_generated`, `run_logged`, `readiness_check_completed`, `debrief_viewed`, `reactivation` events are specified (rs-analytics-001) but not live in PostHog as of 2026-05-24.

---

**Known gaps to fill before using this for high-stakes copy:** real verbatim customer quotes (problem language + product language), at least one testimonial, and live retention/activation numbers once PostHog events are instrumented.
