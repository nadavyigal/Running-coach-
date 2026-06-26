# Plan-generator eval harness

Eval coverage for the highest-stakes AI feature in RunSmart: the training-plan
generator (`app/api/generate-plan/route.ts`). It answers the question deterministic
tests cannot: *is the AI-generated coaching itself safe and good?*

This is the eval layer the "New SDLC / agentic engineering" benchmark flagged as
missing. Tests verify the code; this verifies the model's output.

## Layers

| File | Runs | What it does |
|---|---|---|
| `cases.ts` | — | Golden set: 12 realistic personas + per-case safety bounds. |
| `checks.ts` | free | Deterministic, code-checked safety properties (schema, week count, distance sanity, weekly load cap, no hard sessions in recovery/mindful plans). |
| `judge.ts` | paid | LM-judge (gpt-4o-mini) scoring safety, personalization, progression, rationale clarity, actionability. |
| `generate.ts` | paid | Generates a plan through the **exact** production prompt + schema (imported from `lib/plan/plan-core.ts`), so there is no prompt drift. |
| `checks.test.ts` | free, in CI | Runs the deterministic checks against the deterministic fallback plan. Catches regressions in the safety engine with zero API cost. |
| `plan-eval.live.test.ts` | paid, gated | The real eval: generate → check → judge across the golden set. Skipped unless `RUN_LIVE_EVAL=1`. |

## Running it

```bash
# Free deterministic checks (also runs in normal `npm test` / CI):
npx vitest run evals/plan-generator/checks.test.ts

# Full paid eval against the live model (needs OPENAI_API_KEY):
npm run eval:plan
```

`npm run eval:plan` writes `evals/plan-generator/report.json` (gitignored) with
per-case plans, check results, and judge verdicts.

## The gate

The eval fails (non-zero exit) if either:

1. **Any** safety-critical deterministic check fails on **any** case, or
2. The LM-judge pass rate falls below **0.85** (judge marks `overallPass` and
   `safety >= 4`).

## When it runs

- **Free deterministic checks**: every push, inside normal CI.
- **Paid LM-judge eval**: nightly + as a required pre-release gate
  (`.github/workflows/eval-plan-nightly.yml`). Not per-PR, to control token cost.

## Extending to other AI features

This structure (cases → deterministic checks → LM-judge → gated runner) is the
template for the other LLM features (chat coach, goal discovery, run-from-photo,
adaptive coaching). Copy the folder, swap the generator import and the rubric.
