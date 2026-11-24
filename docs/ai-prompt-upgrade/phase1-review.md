# RunSmart AI prompt upgrade: Phase 1 review

Date: 2026-11-24. Status: **Phase 1 only. Nothing built, no branch, no PR.** Waiting for Nadav's approval before Phase 2.

Scope reviewed: the "FIRST DRAFT" inside `/Users/nadavyigal/Downloads/runsmart-claude-prompt.md`, checked against:

- `nadavyigal/Running-coach-` `origin/main` (cc83c06b) and the model-tier PR #183 (`claude/2026-11-23-openai-model-tiers`, draft, open, not merged on 2026-11-24).
- `nadavyigal/IOS-runsmart-light-app-` `origin/main` (c0c86b1) and PR #253 (same branch name, draft, open, not merged), `supabase/functions/coach_message/`.
- OpenAI docs fetched on 2026-11-24 (deprecations, latest-model, reasoning, reasoning best practices, structured outputs, and the gpt-6.2-sol / gpt-6.1-terra / gpt-6-luna model pages).

> **Phase 2 note (2026-11-24).** Nadav approved this review with changes, which override it where they conflict:
> - Language for structured outputs comes **only** from an explicit `language` field (`"he"` | `"en"`, default `"en"`). `Accept-Language` is never read (sections 4.1 and 10.4 are superseded). No iOS app change in this work.
> - Flex week uses **one fixed `kind` enum** (the app's full WorkoutKind vocabulary), not a per-request enum; the server still checks kinds against current_week.
> - The shared chat core has no "beginner and intermediate" audience line; that line lives in the iOS extra only.
> - No effort or model changes. Token caps rise only after an eval measures Hebrew truncation (only the approved flex week cap changed).
> - Response shapes stay byte-compatible; `source` stays in the flex week response, set by the server.
> - Follow-up only: iOS sends `limitations: []` and never `injurySignal` to run_debrief, so the debrief pain path does not run from the app today.

---

## 0. Verdict in five lines

1. The draft's direction is right (outcome-first prompts, schemas instead of prose JSON, a language rule, evals before and after). Keep it.
2. Several of its facts are now wrong: the model-tier PR exists, `gpt-4o` is no longer hardcoded, and `chatDriver` serves no real users.
3. Its effort advice would break production: `low`/`medium` effort on calls capped at 180 to 500 output tokens can return empty answers. Keep the efforts PR #183 set and evaluated.
4. It misses the two biggest Hebrew risks: (a) the deterministic pain detectors only know English words, and (b) a naive "write in Hebrew" rule in flex week can let a dropped Long Run pass validation.
5. It misses that the iOS app calls the web `run-report`, `generate-plan` and `voice-cue` routes, and that no client sends a language today.

---

## 1. Verified current state (what the draft got right or wrong)

### 1.1 Preconditions

| Draft claim | Reality on 2026-11-24 | Effect |
|---|---|---|
| "Codex model-env PR does not exist" | Exists, written by Claude: Running-coach- **#183** and IOS-runsmart-light-app- **#253**, both draft and open | Phase 2 branches from `claude/2026-11-23-openai-model-tiers` in each repo and rebases if they merge first |
| Env names to invent | Already defined: `OPENAI_MODEL_<TIER>`, `OPENAI_REASONING_EFFORT_<TIER>`; tiers PLAN / WRITER / FAST / VISION / VISION_OCR; older overrides keep priority | Reuse; never re-plumb |
| `generate-plan` hardcodes `gpt-4o` and `temperature: 0.7` | On #183 it reads `selectModel('PLAN')` and passes `providerOptionsFor`. `temperature: 0.7` is still in the code, but `@ai-sdk/openai` 2.0.110 drops it for gpt-6 ids | Nothing to rewire. Leave `temperature` alone in this PR (it still applies if someone rolls back to gpt-4o) |
| `evals/plan-generator/generate.ts` defaults to `gpt-4o` | #183 already reads `OPENAI_MODEL_PLAN`; judge reads `EVAL_JUDGE_MODEL` / `EVAL_JUDGE_EFFORT` | Done already |
| Flex week "not in the FAST map, decide" | #253 maps flex week to FAST | Done already |
| `tts-1` deprecated "6 Jan 2027" | Confirmed on the deprecations page: **2027-01-06**, 8 days before the gpt-4o shutdown, replacement `gpt-realtime-2.1-mini` | Out of scope here, but it is the earliest deadline in the whole migration. Flagged for the parent session |

### 1.2 Each prompt: file, current text, parsing, tier

| # | Prompt | File (PR branch) | How output is used | Tier, effort, cap |
|---|---|---|---|---|
| 1 | Plan | `v0/lib/plan/plan-core.ts:530` `buildPlanPrompt`, called by `v0/app/api/generate-plan/route.ts` | `generateObject({ schema: PlanSchema })`, then `normalizePlan` + `enforcePlanSafety`; fallback plan on failure. **Called by web and by iOS** (`SupabaseRunSmartServices.swift:282`) | PLAN, low, `computeMaxOutputTokens` 1200 to 8000 |
| 2a | Web chat | `v0/app/api/chat/route.ts` `SYSTEM_PROMPT` | `streamText`, free text; client parses `<user_data_update>` in `v0/components/chat-screen.tsx:214` | WRITER (`OPENAI_MODEL` first), none, 500 |
| 2b | `chatDriver` | `v0/lib/chatDriver.ts:312` | **Only used by `/api/chat/ping` (health) and the unused `onboarding/chat/route-new.ts`.** Drops any caller system message (line 318) | FAST |
| 2c | iOS Ask Coach | `coach_message/coach_prompts.ts` `SYSTEM_PROMPT`, `index.ts:666` | Responses API, free text, `instructionsFor` adds linked-coach rules; English fallback text on failure | FAST, none, 260, 12 s timeout |
| 3 | Run debrief | `coach_prompts.ts` `RUN_DEBRIEF_SYSTEM_PROMPT`, `index.ts:47` | Responses, `JSON.parse` on free text, `limitString` 40/300/160/60. **`injurySignal: true` returns the hardcoded English rest message before the model is called**, so the prompt's injury rule never runs | FAST, none, 180, 10 s |
| 3b | Weekly summary (**missing from draft**) | `coach_prompts.ts` `WEEKLY_SUMMARY_SYSTEM_PROMPT`, `index.ts:137` | Responses, `JSON.parse`, same pattern | FAST, none, 220, 10 s |
| 4 | Run report | `v0/app/api/run-report/route.ts:1135` | `generateObject({ schema: InsightSchema })`, then `normalizeInsight` merges with a deterministic fallback. **Called by iOS** (`SupabaseRunSmartServices.swift:1335`) | FAST (`RUN_REPORT_MODEL` first), none, no cap |
| 5 | Flex week | `coach_prompts.ts` `FLEX_WEEK_SYSTEM_PROMPT`, `flex_week.ts:215` | Responses, `JSON.parse`, `validateFlexWeekResponse` (length, ids, long-run count, +10% mileage, back-to-back hard, max 6 changes), deterministic fallback. **Taper weeks return the fallback before the model is called** | FAST, none, 900, **4 s** |

Other prompts the draft lists as "tidy later": voice-cue (`v0/app/api/coach/voice-cue/route.ts`, FAST, 60 tokens, iOS calls it with an 8 s timeout), garmin-insights, workouts/generate, goals/discovery, onboarding chat and goalWizard. Not reviewed in depth; see section 6.

### 1.3 Facts the draft did not have

- **No client sends a language today.** The web app is English-only inside the app (the Hebrew switcher exists only on landing pages). The iOS app is English-first: `Localizable.xcstrings` has 12 Hebrew entries, and `OnDeviceDebriefGenerator.appLanguageIsEnglish` checks `Bundle.main.preferredLocalizations`. Hebrew today means "the athlete types Hebrew".
- **Deterministic pain detectors are English-only.**
  - `run-report/route.ts:349` `hasInjurySignal`: `pain, injury, dizzy, dizziness, sharp, strain`.
  - `coach_message/index.ts:565` `safetyFlagsFor`: `pain|injur|dizzi|chest pain|faint|severe|shortness of breath`.
  - A note like "כאב בברך" or "סחרחורת" raises no flag. Only the prompt protects that athlete, and only while the model is up. The fallback safety texts are English too.
- **Flex week validation reads English labels.** `isLongRun` matches `kind`/`title` containing "long"; `isRestDay` matches "rest" in `distance_label`; `isHardWorkout` matches English kinds. If the model writes `kind: "ריצה ארוכה"` or `title` in Hebrew, a dropped Long Run is no longer counted, and the long-run guard passes.
- **The plan prompt drops useful evidence.** `resolveUser` reads `age`, but `buildPlanPrompt` never prints it (the `masters-runner-58` eval case cannot be personalized by age). `userContext.barriers` and `recentRuns[].notes` are also never printed, so the draft's "injury-return" eval case has no way to reach the model.
- Small bug: `buildWorkoutMixConstraint` returns a line that starts with `- `, and the template adds another `- `, so the prompt prints `- - Keep workout mix...`.
- `v0/__tests__/openai-routes-auth-gate.api.test.ts:372` asserts the chat prompt contains `"expert AI endurance running coach"`. Any chat rewrite must update that test.
- `v0/evals/model-smoke/model-smoke.live.test.ts` reads `SYSTEM_PROMPT` / `COACH_SYSTEM_PROMPT` / `PHASE_PROMPTS` out of route files with a regex (`routeTemplate`). Moving a prompt out of its route file breaks the smoke harness unless it is updated in the same PR.
- iOS sends `coachContext` to the web `run-report`, but the web route ignores it, so linked-coach rules never reach web routes. Out of scope; listed as a follow-up.
- @ai-sdk/openai 2.0.110 (checked in `node_modules`): `strictJsonSchema` defaults to `false`, so `InsightSchema`'s many `.optional()` fields keep working. Switching to strict would need every field required or nullable; not worth it here.

---

## 2. What the official OpenAI docs say (fetched 2026-11-24)

| Topic | Docs | What it means for us |
|---|---|---|
| Shutdown | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini shut down **2027-01-14** (listed replacement gpt-6-luna). tts-1 / tts-1-hd / gpt-4o-mini-tts shut down **2027-01-06** | Matches #183 / #253. TTS is the earlier cliff |
| temperature | Latest-model guide: "omit temperature, top_p, and top_logprobs" | SDK already drops it for gpt-6 ids; the edge function never sent it. Nothing to do |
| Starting effort | "Start with medium for a new integration." If you used none or minimal, "use low instead" | Advice for new integrations. We already have evals: sol at low passed 12/12 with p50 14.5 s. Medium is an eval variant, not the default |
| Reasoning tokens and caps | Caps include "reasoning tokens, visible output tokens"; when hit, `status: incomplete`, output may be empty; start with a large reserve | **This is why the draft's low/medium effort on 180 to 500 token calls is dangerous.** FAST and WRITER stay at none unless caps rise too |
| Effort support | sol rejects none; terra and luna accept none (default medium) | Already handled by `normalizeEffort` / `selectCoachModel` |
| Instructions placement | "Models starting with GPT-6.2 append top-level instructions after input"; put stable instructions in a developer message first in `input` for caching | Only PLAN (sol) is 6.2, and it goes through the AI SDK, which sends `system` as a developer message for reasoning models. The edge function uses luna (gpt-6), so `instructions` is fine. Our prompts are under ~1k tokens, so caching gains are small. **The draft over-weights caching** |
| "Be concise" | Revisit "be concise" style lines; new models are concise by default | Keep length rules only where the UI needs them (debrief headline 40 chars, voice cue 25 words) |
| Step-by-step | Reasoning best practices: "think step by step" is unnecessary and can hurt; be specific about the end goal; use section titles or delimiters | Remove numbered process lists (plan's "CRITICAL INSTRUCTIONS 1-6"); keep the goal and the rules |
| Structured outputs | Responses: `text: { format: { type: "json_schema", name, strict: true, schema } }`; strict needs every field required (nullable instead of optional), `additionalProperties: false`; app must still handle refusals, incomplete responses and API errors. All three gpt-6 pages list structured outputs as supported | Use strict schemas in the edge function (debrief, weekly, flex week). Keep `JSON.parse` + validators + fallbacks because refusals and incomplete responses still happen |
| text.verbosity | Not documented on the three model pages | **Drop the draft's `text.verbosity` suggestion** |
| Pricing per 1M (input / output) | sol $2 / $10, terra $1 / $5, luna $0.10 / $0.50 | Eval cost estimate in section 9 |

---

## 3. Critique of the draft

### 3.1 Wrong

1. Says the model-env PR does not exist and tells the agent to stop. It exists (#183, #253).
2. Says `generate-plan` hardcodes `gpt-4o`. Fixed on #183.
3. Effort advice: PLAN medium, WRITER low/medium, FAST low. On our caps (debrief 180, weekly 220, chat 260, web chat 500, voice cue 60) reasoning tokens eat the budget and can return an empty answer, which silently falls back. #183 chose PLAN low and everything else none for exactly this reason, and evals back it. **Keep #183's efforts. Effort changes are out of scope for a prompt PR** (the task's hard rule says so too).
4. Treats `chatDriver` as a live surface to upgrade. It has no real users (health ping plus an unused route). Upgrading it adds diff and no value.
5. Debrief rewrite tells the model to "honor" the injury case. The server returns before calling the model when `injurySignal` is true, so that text is dead. Leaving it costs tokens and invites drift between two copies of the wording.
6. Flex week rewrite keeps the taper rule. The server short-circuits taper weeks before the model call. Dead text.
7. Recommends `text.verbosity`. Not documented for these models.

### 3.2 Missing

1. **Hebrew safety detectors** (section 1.3). The single most important gap: for a Hebrew athlete, injury safety today depends only on the model.
2. **Flex week label vocabulary.** "Write in Hebrew" must apply to `rationale` and `safety_warnings` only. Every workout field stays in the existing English vocabulary, or the long-run and rest checks can be bypassed.
3. **The weekly summary prompt** (`WEEKLY_SUMMARY_SYSTEM_PROMPT`). Same JSON-parse pattern as the debrief, same fix.
4. **Where the language comes from.** The draft says "pass a language" but no client has one. Needs a resolution rule and a default that changes nothing.
5. **The iOS app calls three web routes** (`generate-plan`, `run-report`, `voice-cue`). Their response shapes are iOS contracts too, not only the edge function's.
6. **The flex week timeout bug.** Flex week falls back on every model in production (4 s abort), and 900 output tokens truncates the full week. A prompt rewrite alone cannot fix this.
7. **Hebrew token cost.** Hebrew needs more tokens per word than English (my guess: about 1.5x to 2.5x; measure in the evals). Debrief 180 and weekly 220 caps may truncate Hebrew JSON.
8. **Gender in Hebrew.** Hebrew verbs and adjectives are gendered. The prompt must ask for neutral phrasing (infinitives, "כדאי", plural-neutral forms) instead of guessing.
9. **Pace format.** The debrief context sends `averagePaceMinPerKm` as decimal minutes (5.42). Without a rule the model may print "5.42 min/km". Tell it to write m:ss.
10. **Evidence the plan prompt drops** (age, barriers, run notes). The draft's injury-return eval case cannot work without it.
11. **Tests that pin prompt text** (auth-gate test, `model-smoke` regex reader, `coach_prompt_test.ts`).
12. **Chest pain and fainting wording.** Current text says "consult a qualified professional". For chest pain, fainting or trouble breathing during exercise, "get urgent medical help" is the stronger and correct wording. Allowed by the "never weaker" rule; flagged for Nadav because it is new user-facing safety copy.

### 3.3 Over-engineered

1. Four new eval folders, each with its own judge. The repo already has two harnesses (`evals/plan-generator/`, `evals/model-smoke/`) plus `coach_message/smoke_live.ts`. Extend those; add one small `evals/coach-prompts/` folder only for the free deterministic checks that need fixtures.
2. Prompt-caching guidance. Prompts are short and traffic is small; savings are cents.
3. Migrating `goals` and `onboarding` to structured outputs in the same PR. Separate, later.
4. Unifying web and iOS chat through shared code. They live in different repos. Share the **rules text** and pin it with a phrase test in each repo instead.

### 3.4 Weak rewrites

- **Plan:** drops the per-metric pace guidance (tempo vs LT, easy vs LT, HR ranges) that makes VDOT plans specific. Keeps a generic "use them for paces". Kept and condensed below.
- **Run report:** deletes the product rubric (stride-detection rule, cadence / ground contact / vertical oscillation reference ranges, ACWR sweet spot, scoring bands). That is coaching knowledge, not schema echo. Moved into Zod `.describe()` on the schema fields below, so the guidance sits next to the field and the system prompt gets shorter.
- **Chat:** "Be concise (about 3-6 sentences)" plus "one clear next action" is fine, but it drops current web topics (technique, nutrition, injury prevention) and the iOS supportive vocabulary ("adjust, recover, next best step, still on track"). Both kept below.
- **Flex week:** keeps "same array length" without saying "copy unchanged workouts exactly" and without the label-vocabulary rule. Both added below.

---

## 4. Cross-cutting design (applies to every rewrite)

### 4.1 Language rule

| Surface | Rule | Needs plumbing? |
|---|---|---|
| Free-text chat (web `/api/chat`, iOS `coach_message` chat) | Reply in the language of the athlete's latest message. Mixed message: use the main language | No |
| Structured outputs (plan, run report, debrief, weekly, flex week) | `resolveLanguage(body, headers)`: `body.language` if `"he"` or `"en"`; else the first `Accept-Language` tag if it starts with `he` or `iw`; else `"en"` | Optional new request field; **default `"en"` keeps today's behavior** |

- JSON keys, enum values, weekday tokens (`Mon`..`Sun`), workout `type` values and flex week workout fields stay English always.
- Hebrew style block (used only when language is `he`):
  `Write in natural, simple Hebrew. Use gender-neutral phrasing (infinitives, "כדאי", "אפשר") instead of guessing the runner's gender. Use Western digits, "ק״מ" for kilometers, and write paces as m:ss לק״מ.`
- **Guess, must verify on a device:** URLSession adds an `Accept-Language` header from the app's preferred localizations. If that is true, Hebrew iOS users get Hebrew structured output with zero iOS changes. If not, a one-line iOS change sends `language` explicitly (separate iOS PR, Nadav's call).

### 4.2 Effort and token caps

- Efforts: unchanged from #183 / #253 (PLAN low; WRITER, FAST none).
- Caps: raise only where Hebrew may truncate, and only after the eval measures it. Proposed starting points, all ceilings (cost is per token used, so a higher cap costs nothing unless used): debrief 180 → 300, weekly 220 → 350, iOS chat 260 → 400, flex week 900 → 2000. Web chat 500 stays.
- Every edge-function call: treat `status: "incomplete"` or a `refusal` as a fallback with a logged reason (today it fails later as a JSON parse error).

### 4.3 Structured outputs

- Web routes already use `generateObject` with Zod. Keep it. Remove the inline JSON example from the plan prompt (it duplicates `PlanSchema` and the sample `"distance": 4` can anchor answers). Per-field guidance goes into `.describe()`.
- Edge function: add `text.format` with `strict: true` for debrief, weekly summary and flex week. Keep `JSON.parse`, `limitString`, `validateFlexWeekResponse` and every fallback.

### 4.4 Shared safety rules

One "safety core" text, copied into web chat and iOS chat, pinned by a phrase test in each repo (`stop the activity`, `qualified professional`, `urgent medical help`, `do not diagnose`). Structured prompts carry a shorter version adapted to their field.

---

## 5. Improved rewrites: before → after

Legend: **[NEW]** not in the draft, **[CHANGED]** differs from the draft, **[KEPT]** same as the draft.

### 5.1 Plan generation (`v0/lib/plan/plan-core.ts` `buildPlanPrompt`)

**Before** (PR #183, template; blocks only appear when data exists):

```
Create a running training plan. Return JSON only with this shape:
{
  "title": "string",
  "description": "string",
  "totalWeeks": ${totalWeeks},
  "workouts": [
    {"week": 1, "day": "Mon", "type": "easy", "distance": 4, "duration": 24, "notes": "string"}
  ]
}

Runner profile:
- Experience: ${user.experience}
- Goal: ${user.goal}
- Days per week: ${user.daysPerWeek}
- Preferred times: ${user.preferredTimes.join(', ')}
${weeklyKmContext}
${advancedMetricsContext}      // VDOT/VO2/LT/HR lines + "CRITICAL INSTRUCTIONS FOR USING THESE METRICS" 1-6 + "PACE ZONE CALCULATIONS" + "Do not use generic paces when VDOT is available. Calculate specific paces."
${trainingHistoryContext}      // RECENT TRAINING HISTORY + "Respect recent load; avoid abrupt spikes in frequency or intensity."
${goalsContext}                // GOAL CONTEXT + "Prioritize alignment with goals without violating challenge intent or safety."
- Plan type / Target distance / Training volume / Difficulty (when present)
${challengeContext}            // CHALLENGE CONTEXT + INSTRUCTIONS (align to pattern and tone, keep length to duration, preserve experience and availability)

Constraints:
- totalWeeks must be ${totalWeeks}
- Schedule workouts only on: ${trainingDays.join(', ')}
- Long run day: ${longRunDay}
- ${buildWorkoutMixConstraint(challenge)}        // prints "- - ..." (double dash bug)
${intensityRule}
- Do NOT increase total weekly distance by more than 10% versus the previous week.
- No single run may exceed ${policy.maxWorkoutKm} km.
- Distances are in kilometers, durations in minutes.
- Keep progression gradual and safe.
- ${advancedMetrics?.vdot ? 'Use VDOT-based pace zones for all workout intensities.' : 'Use conservative pace progression.'}
```

**After:**

```
Write a running training plan for the runner below. The plan is shown in the app as written: title, description and each workout's notes are read by the runner.

Goal: a plan this runner can follow week by week that fits their experience, goal, available days and recent load, and builds gradually toward the goal.

Hard rules:
- totalWeeks is ${totalWeeks}; use weeks 1 to ${totalWeeks}.
- Schedule workouts only on: ${trainingDays.join(', ')}. The long run is on ${longRunDay}.
${intensityRule}
- Total weekly distance grows at most 10% over the previous week.
- No single run is longer than ${policy.maxWorkoutKm} km.
- Distances in kilometers, durations in minutes; rest days have distance 0.
- If anything below mentions pain, injury, illness or a return after time off: keep the first two weeks easy and short, and say in the description to stop and see a qualified professional if pain returns. Do not diagnose.

Workout mix: ${workoutMixText}

Workout notes: one sentence per non-rest workout with its purpose and effort. ${paceRule}

Language: write title, description and notes in ${languageName}. Keep schema values in English: type (easy, tempo, intervals, long, time-trial, hill, rest) and day (Mon to Sun).
${hebrewStyleBlock}

Runner:
- Experience: ${user.experience}
- Goal: ${user.goal}
- Days per week: ${user.daysPerWeek}
- Preferred times: ${preferredTimes}
- Age: ${age}                                 [only when present]
- Current weekly volume: ${averageWeeklyKm} km [only when present]
- Says it gets in the way: ${barriers}         [only when present, sanitizeForPrompt, max 3 x 80 chars]
- Plan type / Target distance / Training volume / Difficulty [only when present]

${trainingHistoryBlock}   // same lines as today, plus each recent run's note (sanitizeForPrompt, 80 chars); closing line kept: "Respect recent load; avoid sudden jumps in frequency or intensity."
${goalsBlock}             // unchanged content
${challengeBlock}         // unchanged content; closing lines kept
```

with

```
paceRule (VDOT or LT present):
  Use the metrics for paces: easy runs 60-90 s/km slower than LT pace, long runs 90-120 s/km slower, tempo at LT pace or up to 10 s/km slower, intervals at the VDOT interval (I) pace, short reps at R pace. If LT heart rate is given, add a heart-rate range to tempo and interval notes.
  Metrics: VDOT ${vdot} | VO2max ${vo2} | LT pace ${lt}/km | LT HR ${lthr} | Max HR ${maxhr} | Resting HR ${rhr}   [present ones only]
paceRule (no metrics):
  Describe effort by feel (easy = conversational, tempo = comfortably hard). Do not invent pace numbers.
```

Code notes for Phase 2: add optional `language?: 'en' | 'he'` to `PlanRequest` and a last positional parameter to `buildPlanPrompt` (eval `generate.ts` imports it, so the signature stays backward compatible); fix the double dash by making `buildWorkoutMixConstraint` return text without the leading `- `; keep `sanitizeForPrompt` on every user string; keep `enforcePlanSafety` exactly as is.

Changes from the draft:
- **[CHANGED]** No "Role:" / "Success criteria:" / "Output:" headings. The schema already defines the output, and short headed sections read better than a template. Same outcome-first idea.
- **[CHANGED]** Pace guidance kept and condensed (draft dropped it).
- **[NEW]** Age, barriers and run notes now reach the model; injury-return rule spells out "first two weeks easy and short" instead of a vague "conservative".
- **[NEW]** Hebrew style block, rest-day distance 0, double-dash fix.
- **[CHANGED]** No route rewiring and no effort change (already done in #183).

### 5.2 Chat: shared safety core, web and iOS

**Before, web** (`v0/app/api/chat/route.ts`):

```
You are an expert AI endurance running coach. You provide helpful, encouraging, and scientifically-backed advice about running training, technique, nutrition, injury prevention, and motivation. Keep responses concise but informative.

Safety: This is not medical advice. If the runner reports pain, dizziness, chest pain, or unusual symptoms, advise stopping training and consulting a qualified professional.

If the user explicitly confirms saving a metric or profile detail, append a final line with a <user_data_update> JSON block, for example:
<user_data_update>{"message":"I can save that lactate threshold pace for you.","data":{"lactateThreshold":270}}</user_data_update>

Only include this block after explicit confirmation. Do not wrap it in markdown.
```

**Before, iOS** (`coach_prompts.ts` `SYSTEM_PROMPT`):

```
You are RunSmart Coach, a calm AI running coach for beginner and intermediate runners.

Your job is to turn the runner's current context into one clear next action.

Rules:
- Be concise: 3-6 sentences unless the user asks for detail.
- Use only the provided training context.
- If data is missing, say so honestly.
- Do not diagnose injuries or give medical advice.
- If the user mentions pain, dizziness, chest pain, fainting, or severe symptoms, advise stopping activity and consulting a qualified professional.
- Do not shame missed workouts.
- Prefer conservative training guidance under uncertainty.
- Do not claim you changed the training plan unless an action was actually applied.
- Do not expose raw GPS data or private route details.
- Use supportive language: adjust, recover, next best step, still on track.
- Give one practical next action.
```

**After, shared core** (identical text in both repos):

```
You are RunSmart Coach, a calm running coach for beginner and intermediate runners.

Goal: answer the runner's message and end with one clear, practical next step, using only the training context provided.

Rules:
- Reply in the language of the runner's latest message (Hebrew or English). In Hebrew, use simple, natural, gender-neutral phrasing.
- Keep it to 3-6 sentences unless the runner asks for more detail.
- Use only the provided context. Do not invent runs, paces, heart rates or plan details. If something you need is missing, say so and ask for the one fact that matters most.
- This is not medical advice. Do not diagnose injuries or illness.
- If the runner mentions pain, dizziness, chest pain, fainting, shortness of breath or other severe symptoms: tell them to stop the activity and talk to a qualified professional. For chest pain, fainting or trouble breathing, tell them to get urgent medical help. Keep any training suggestion conservative.
- When unsure, choose the more conservative option.
- Do not shame missed workouts. Use supportive words: adjust, recover, next best step, still on track.
- Do not say you changed the training plan unless a change was actually applied.
- Do not reveal raw GPS data, coordinates or private route details.
```

**Web extra** (appended after the core):

```
You can also answer questions about running technique, nutrition, injury prevention and motivation, with practical, evidence-based advice.

Saving data: only after the runner explicitly confirms saving a metric or profile detail, end your reply with one line:
<user_data_update>{"message":"...","data":{...}}</user_data_update>
Example: <user_data_update>{"message":"I can save that lactate threshold pace for you.","data":{"lactateThreshold":270}}</user_data_update>
The tag and JSON keys stay in English; "message" follows the reply language. Do not wrap it in markdown.
```

**iOS extra:** none. `instructionsFor` keeps appending the linked-coach rules unchanged.

Changes from the draft:
- **[CHANGED]** Language from the message, not a `language` field (nobody sends one; works today with no plumbing).
- **[NEW]** Urgent-care line for chest pain, fainting, trouble breathing; "shortness of breath" added to the list (the iOS detector already flags it).
- **[NEW]** Keeps the iOS supportive vocabulary and the web topic scope (draft dropped both).
- **[CHANGED]** `chatDriver` dropped from scope (no real users).
- **[CHANGED]** No effort change (draft: low). WRITER and FAST stay at none.
- Phase 2 must update `openai-routes-auth-gate.api.test.ts:372` and add a phrase test in each repo.

### 5.3 Run debrief (`RUN_DEBRIEF_SYSTEM_PROMPT`, `index.ts` `generateRunDebrief`)

**Before:** see section 1.2 row 3 (text in `coach_prompts.ts`: "Return ONLY valid JSON ... in exactly this shape: {headline, debrief, tomorrow, planImpact}" plus rules, including the injury rule that never runs).

**After:**

```
You are RunSmart Coach writing a short debrief right after a run. The runner reads it in a few seconds, so it must show you looked at this run.

- headline: one short reaction, at most 40 characters.
- debrief: 1-2 sentences that cite at least one real number from the run data (distance, pace, heart rate or effort rating).
- tomorrow: one sentence on what this run means for tomorrow.
- planImpact: a short phrase, or null when the plan is not affected.

Rules:
- Use only numbers from the run data; never invent one. Pace values are decimal minutes per km: write them as m:ss (5.5 becomes 5:30).
- Warm and direct, no filler. Never shame the result.
- This is not medical advice; do not diagnose. If limitations mention pain, illness or discomfort, tomorrow must recommend rest or an easy day and suggest a qualified professional if it continues.
- When unsure, be conservative.

Language: write all four fields in ${languageName}.
${hebrewStyleBlock}
```

Request change: add `text: { format: { type: "json_schema", name: "run_debrief", strict: true, schema } }` with `headline`, `debrief`, `tomorrow` as strings and `planImpact` as `["string", "null"]`, all required, `additionalProperties: false`. Keep `JSON.parse`, `limitString` and both fallbacks. Cap 180 → 300 (measure first). Add a Hebrew version of the injury short-circuit text, used when language is `he` (see 5.7).

Changes from the draft:
- **[CHANGED]** Removed the dead injury rule; replaced with a rule for `limitations` (the field that does reach the model).
- **[NEW]** Pace format rule, Hebrew style, cap raise, Hebrew injury fallback.
- **[KEPT]** Strict structured output; keep the existing hardcoded injury path.

### 5.4 Weekly summary **[NEW, missing from draft]**

**Before:** `WEEKLY_SUMMARY_SYSTEM_PROMPT` in `coach_prompts.ts` (JSON shape inline: headline max 50 chars, narrative 2-3 sentences, forwardLook, weekLabel; rules about numbers, no shame, zero-run case).

**After:**

```
You are RunSmart Coach writing a short end-of-week summary for the runner.

- headline: the key stat that shows something changed, at most 50 characters (for example "3 runs · 18 km · 4th week in a row").
- narrative: 2-3 sentences: what was built this week, what the data shows, why it matters.
- forwardLook: one sentence on what next week builds toward.
- weekLabel: a short context label, for example "Week 4 of your plan" or "Week 3 with RunSmart".

Rules:
- Cite real numbers from the week data (runs, distance, change versus last week when given). Never invent one.
- Warm, direct, forward-looking. If runsCompleted is below runsPlanned, acknowledge the effort without guilt. If runsCompleted is 0, still write a short encouraging summary.
- If isRecoveryWeek is true, frame lower volume as planned recovery, not a drop.
- This is not medical advice; do not diagnose. When unsure, be conservative.

Language: write all four fields in ${languageName}.
${hebrewStyleBlock}
```

Request change: strict `json_schema` (`weekly_summary`), cap 220 → 350.

### 5.5 Run report (`v0/app/api/run-report/route.ts`)

**Before:** the system prompt in section 1.2 row 4 (about 2,400 characters: CORE FIELDS, ENHANCED FIELDS, PACING RULES, SCORING GUIDE), plus a user message with the skill input and a pacing block.

**After, system prompt:**

```
You are RunSmart, an evidence-based running coach writing the post-run report for this run. Be supportive, specific and practical, and cite the run's own numbers.

Fill the core fields every time: summary, effort, metrics.paceStability, recovery.priority, nextSessionNudge. Fill an enhanced field only when the input supports it; otherwise leave it out. Never invent telemetry, VDOT, race predictions or comparisons with past runs that were not provided.

Safety: this is not medical advice; do not diagnose. If the notes or soreness mention pain, dizziness or injury, add a safety flag with code injury_signal, tell the runner to stop if it persists and see a qualified professional, and make the next session rest or gentle cross-training.

Scoring (coachScore.overall): 90-100 excellent execution, right effort, steady pacing; 75-89 good with small issues; 60-74 notable issues such as erratic pacing or the wrong effort for the run type; below 60 serious concerns such as injury signals. A well-executed easy run can score 90+.

Language: write every text field the runner reads in ${languageName}. Keep enum values (easy, moderate, hard, consistent, fading, negative-split, erratic, excellent, good, fair, needs-work, improving, maintaining, declining, and safety flag codes) in English.
${hebrewStyleBlock}
```

**After, field guidance moved into `InsightSchema` via `.describe()`** (text the model sees next to each field):

- `summary`: "Up to 4 short lines: 1) headline with distance, duration and average pace; 2) one specific thing that went well; 3) the adaptation this run builds; 4) how it sets up the next session."
- `effort`: "From RPE, pace, heart rate and run type."
- `recovery.priority`: "2-3 concrete recovery steps."
- `pacingAnalysis`: "1-2 sentences. If strideDetection.detected is true, describe the strides (neuromuscular activation, running economy) and compare peak pace with average; otherwise assess consistency, fade or negative split."
- `biomechanics`: "Only when runningDynamics is provided. Typical reference ranges: cadence about 170-180 spm, ground contact under 250 ms, vertical oscillation under 8 cm. Treat them as references, not targets every runner must hit."
- `trainingContext`: "Only when historicalContext.recentRuns is provided. ACWR 0.8-1.3 is the usual safe range."
- `raceReadiness`: "Only when VDOT is known: 5K / 10K / half / marathon predictions and fitness direction."
- `detailedRecovery`: "Timed phases: immediate, next2h, next24h, and next48h after hard efforts only."
- `structuredNextWorkout`: "Phased next workout: warmup, main, cooldown, total minutes, target effort, one coaching cue."

The user message stays as today (skill input JSON + pacing block). Remove its last line "Return JSON that matches the provided schema." (the SDK sends the schema).

Code notes: `InsightSchema` keys, enums and the `{ report, source }` response stay byte-compatible for iOS. `.describe()` changes only the JSON schema descriptions sent to OpenAI. Do not enable strict mode (many optional fields).

Changes from the draft:
- **[CHANGED]** Rubric kept, moved into schema descriptions (draft deleted it).
- **[NEW]** Safety rule names the exact flag code; the next-session rest rule matches the deterministic fallback text.
- **[CHANGED]** Biomechanics ranges labelled as references, not targets.

### 5.6 Flex week (`FLEX_WEEK_SYSTEM_PROMPT`, `flex_week.ts`)

**Before:** see section 1.2 row 5 (inline JSON shape including `"source": "live_ai"`, 10 safety rules including the taper rule and the ACWR rule).

**After:**

```
You are RunSmart Coach. The runner hit a life disruption (the reason is in the request). Rework the rest of their current week so it absorbs the disruption and stays safe.

Return:
- restructured_week: the same workouts as current_week, same length and the same workout_id values, with fields updated in place. Copy every unchanged workout exactly.
- changes: one entry per changed workout, each with a one-sentence rationale the runner will read.
- safety_warnings: short notes for the runner, or an empty list.

Hard rules (a week that breaks one is rejected and the runner gets the standard plan):
- Never drop a Long Run. Shorten, downgrade or move it instead.
- Weekly distance must not rise more than 10% versus current_week.
- No back-to-back hard days (tempo, intervals, hills, long run, race).
- At most 6 changes. Never turn a rest day into a hard effort.
- Sick: no hard sessions within 48 hours after the last sick day.
- Do not change workouts that are complete (is_complete true).
- Do not diagnose illness or injury. When unsure, choose the easier week.

By reason:
- tired: ease the next one or two hard sessions; keep the long run, shorter if needed.
- traveling: move or shorten workouts on blocked_days.
- missed_workout: do not cram it back in; fit its key part only if the rules allow.
- sick: rest for sick_days_out days, then ease back in.

Load: if readiness_context.acwr is above 1.5 (load_status "highRisk"), cut volume, protect rest days and mention the load spike in one rationale. If it is below 0.8, avoid cutting volume further unless a rule requires it.

Field values: keep kind, title, distance_label, detail_label and intensity in the same English vocabulary used in current_week. A downgraded workout uses kind "Easy Run" and intensity "easy". A rest day uses kind "Recovery", title "Rest", distance_label "Rest", intensity "rest". Write distances as "<number> km".

Language: write rationale and safety_warnings in ${languageName}. Everything else stays exactly in the vocabulary above.
${hebrewStyleBlock}
```

Request changes, two steps:

- **Step A (do first, small):** strict `json_schema` (`flex_week`) where `kind` is an enum built per request from current_week's kinds plus "Easy Run" and "Recovery", `change_type` is the existing enum, `original_workout_id` is `["string","null"]`; drop `source` from the model output (the server sets it); timeout 4 s → 10 s (the iOS request has no short timeout; URLSession default 60 s); cap 900 → 2000. Keep `validateFlexWeekResponse` and `fallbackFlexWeek` unchanged. Add a deterministic check that every restructured `kind` belongs to the allowed set (stronger guard, small).
- **Step B (only if Step A evals show valid rate under 90% or p95 over 8 s):** the model returns only `changes` with patch fields (`new_scheduled_date`, `new_kind`, `new_distance_label`, ...); the server applies them to a clone of current_week and runs the same validator. Output drops from ~1,200 tokens to ~200. Response shape to iOS stays identical. More code, so not first.

Changes from the draft:
- **[CHANGED]** Removed dead taper rule and the `source` field.
- **[NEW]** Label vocabulary rule and per-request `kind` enum (closes the Hebrew bypass of the long-run check).
- **[NEW]** "Copy unchanged workouts exactly", "do not change completed workouts", per-reason guidance (mirrors what the fallback rules already do; verify against `applyTiredRule` and friends in Phase 2).
- **[NEW]** Timeout and cap fix for the production fallback bug (draft only said "do not start at high").

### 5.7 Deterministic safety additions **[NEW]**

Prompts do not replace guards; these strengthen guards for Hebrew. Small code, high value.

1. Hebrew keywords in `run-report/route.ts` `hasInjurySignal` and `coach_message/index.ts` `safetyFlagsFor`: `כאב`, `כואב`, `פציעה`, `פצוע`, `נפצע`, `נקע`, `סחרחורת`, `סחרחר`, `מסוחרר`, `התעלפ`, `עילפון`, `לחץ בחזה`, `קוצר נשימה`, `דקירה`. Not `מתיחה` (also means "stretching"; false positives).
2. Hebrew versions of the English safety fallback texts (`fallbackCoachResponse` medical caution, debrief injury short-circuit), used when the message or `language` is Hebrew. Draft wording for Nadav's review:
   - Chat medical caution: "אם יש כאב, סחרחורת, כאב בחזה, התעלפות או תסמינים חמורים, כדאי לעצור את הפעילות ולפנות לאיש מקצוע מוסמך. בכאב בחזה, התעלפות או קושי לנשום, יש לפנות מיד לעזרה רפואית. ההחלטה להיום צריכה להיות זהירה."
   - Debrief injury headline: "מנוחה עכשיו, להקשיב לגוף"; debrief: "כל כאב או אי נוחות אחרי ריצה דורשים קודם מנוחה. כדאי להתייעץ עם איש מקצוע לפני האימון הבא."; tomorrow: "מחר יום מנוחה מלא."
3. Unit tests for both detectors with Hebrew and English inputs.

### 5.8 Dropped or parked

| Item | Decision | Why |
|---|---|---|
| `chatDriver` prompt | Drop | No real users |
| `onboarding/chat/route-new.ts` | Drop | Unused |
| voice-cue prompt | Park | iOS speaks with `en-US` voices (`LocalRunCueService.swift:199`) and tts-1 is being replaced; Hebrew cues belong with the TTS migration |
| garmin-insights, workouts/generate, goals, onboarding | Park to a later PR | Lower traffic; not needed for the 2027-01-14 date |
| web routes ignoring iOS `coachContext` | Follow-up | Product gap, not a prompt change |

---

## 6. Eval plan (improved)

Principle: extend the harnesses that exist; free checks in CI; paid runs only under a cost cap Nadav sets.

### 6.1 Plan (`v0/evals/plan-generator/`, existing)

- Add `language?: 'en' | 'he'` to `EvalCase`; `generate.ts` passes it through.
- New cases (keep the 12): `hebrew-beginner-5k` (language he), `injury-return-intermediate` (barriers: "coming back from shin splints", one recent run note "sore shin"), `hebrew-advanced-vdot` (he, VDOT and LT present, checks pace notes stay specific in Hebrew).
- New deterministic checks: `hebrew-prose` (critical for he cases: title, description and at least 80% of notes contain Hebrew letters `֐-׿`); `injury-return-easy-start` (non-critical, reported: weeks 1-2 have no hard sessions and no week-1 run over the runner's recent max). Enum checks are not needed (Zod already enforces them).
- Baseline vs candidate: run `npm run eval:plan` with `EVAL_REPORT_FILE=report-baseline.json` on #183's head, then on the Phase 2 branch with `report-candidate.json`. Compare critical failures, fallback count, judge pass rate and dimension averages. Gate unchanged: 0 critical, judge pass ≥ 0.85. Do not loosen. Optional variant: `OPENAI_REASONING_EFFORT_PLAN=medium` (for information, not to change the default).

### 6.2 Chat, debrief, weekly, flex week, run report

- **Free, in CI:** a small `v0/evals/coach-prompts/` with fixtures and `checks.test.ts`: run-report `InsightSchema.safeParse` on fixture outputs; `hasInjurySignal` Hebrew/English table; chat phrase test (safety core present in `SYSTEM_PROMPT`). In the iOS repo: Deno tests for `safetyFlagsFor` Hebrew, the strict schema objects, the `kind` allowed-set check, the phrase test on `SYSTEM_PROMPT`, and `validateFlexWeekResponse` against a Hebrew-kind attack fixture (must reject).
- **Paid, gated** (`RUN_LIVE_SMOKE=1` web, `deno run smoke_live.ts` iOS): extend the existing smoke harnesses with these cases, run old prompt and new prompt with the same inputs:
  - Chat: Hebrew question; Hebrew pain message ("כואב לי בברך"); chest pain in English; "did you change my plan?"; context with coordinates (must not echo); missing data. Checks: reply language, required safety phrases, no coordinates, no "I changed your plan".
  - Debrief: easy run, tempo run, limitations with pain, Hebrew. Checks: strict JSON valid, headline ≤ 40 chars, a real number cited, m:ss pace format, Hebrew letters when he, `incomplete` rate.
  - Weekly: normal week, zero runs, recovery week, Hebrew.
  - Flex week: tired, traveling, missed, sick, high ACWR, low ACWR, Hebrew rationale, back-to-back hard attempt. Checks: `validateFlexWeekResponse` passes (critical), source `live_ai` rate, p50/p95 latency under the new 10 s timeout.
  - Run report: easy well-executed run, race with fade, pain in notes (English and Hebrew), missing pace data, Hebrew. Checks: schema valid, `injury_signal` flag on pain, no invented VDOT, Hebrew text fields when he, enums English.
- Report each as a table in `v0/evals/plan-generator/BASELINE.md` style (one new dated section), committed as a summary only, not raw outputs.

### 6.3 Gates for Phase 2 "done"

- 0 critical failures anywhere; plan judge ≥ 0.85.
- Flex week live valid rate ≥ 90% (today: 0% in production because of the 4 s abort).
- Debrief / weekly `incomplete` rate 0 in English and Hebrew.
- Every Hebrew pain fixture raises the deterministic flag.
- Existing tests green: `npm run lint`, `npm run type-check` (or the repo equivalent), `npx vitest run`, `deno test` in `coach_message/`.

---

## 7. Implementation order (Phase 2, after approval)

One story at a time, each verified before the next. Two draft PRs, one per repo, on top of the model-tier branches.

**iOS repo (`IOS-runsmart-light-app-`, branch from `claude/2026-11-23-openai-model-tiers`):**

1. Hebrew keywords in `safetyFlagsFor` + Hebrew safety fallbacks + tests. (Guards first.)
2. Flex week Step A: prompt, strict schema with per-request `kind` enum, allowed-kind check, timeout 10 s, cap 2000, `incomplete`/refusal handling, tests. Live smoke before and after.
3. Debrief and weekly: prompts, strict schemas, caps, language resolution, Hebrew injury short-circuit text, tests.
4. Chat: shared safety core, phrase test, cap 400.

**Web repo (`Running-coach-`, branch from `claude/2026-11-23-openai-model-tiers`):**

5. Hebrew keywords in `hasInjurySignal` + tests.
6. Plan prompt rewrite + `language` field + evidence lines + double-dash fix; eval cases and checks; baseline vs candidate.
7. Run report: system prompt + `.describe()` + language; fixtures.
8. Web chat: shared safety core + web extra; update auth-gate test; phrase test; update `model-smoke` if a prompt moves.

Each PR body: the base PR (#183 / #253), files changed, eval commands and before/after tables, remaining risks, this document as the design doc. Draft only, never merged by the agent.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Hebrew output truncates under current caps | Caps raised as ceilings; `incomplete` rate measured in evals |
| Hebrew `kind`/`title` bypasses flex week guards | Vocabulary rule + strict `kind` enum + allowed-kind check |
| Prompt rewrite lowers plan quality | Baseline vs candidate on the same 12 + 3 cases; 0.85 gate |
| Chat prompt text pinned by tests | Update auth-gate test and smoke harness in the same PR |
| `Accept-Language` not sent as expected by iOS | Default stays English; explicit iOS `language` field as follow-up |
| New urgent-care wording | Shown to Nadav for approval (decision 2) |
| #183 / #253 change or merge during Phase 2 | Rebase; reuse their names; never re-plumb |
| tts-1 shuts down 2027-01-06, before the rest | Not in this work; flagged for the parent session |

---

## 9. Eval cost estimate (only an estimate; nothing paid has run in Phase 1)

Prices from the model pages (2026-11-24). Per-call sizes from `BASELINE.md` where measured, otherwise my estimate.

| Run | Calls | Est. cost |
|---|---|---|
| Plan eval, 15 cases, sol low, baseline + candidate (measured ~$0.0115 per plan) | 30 + 30 judge (luna) | ~$0.40 |
| Plan eval, optional medium-effort variant | 15 + 15 | ~$0.25 |
| Web chat, 6 cases x old/new x 2 repeats, terra none | 24 | ~$0.10 |
| Run report, 6 fixtures x old/new x 2, luna | 24 | ~$0.05 |
| coach_message (chat, debrief, weekly, flex), ~30 cases x old/new x 2, luna | ~120 | ~$0.10 |
| **Total for one full before/after round** | | **~$1** |
| With re-runs after prompt fixes (3 rounds) | | **~$3** |

Recommended cost cap: **$5**.

---

## 10. Decisions only Nadav can make

1. **Cost cap for paid evals.** Recommendation: $5.
2. **New urgent-care line** ("for chest pain, fainting or trouble breathing, get urgent medical help") in English chat, and the Hebrew safety texts in 5.7. Recommendation: approve both; they only make safety stronger.
3. **Include the Hebrew safety guards (5.7) in this prompt work**, even though they are code, not prompts. Recommendation: yes, first story in each repo.
4. **Language for structured outputs:** accept `language` / `Accept-Language` with English default now, and later send `language` explicitly from iOS (one-line iOS change, separate PR). Recommendation: yes to the server part now; the iOS part after checking a device.
5. **Flex week timeout 4 s → 10 s.** The runner waits longer on the loading screen, but today every request falls back. Recommendation: 10 s.
