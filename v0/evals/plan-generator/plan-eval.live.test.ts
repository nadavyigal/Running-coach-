/* eslint-disable no-console -- this runner intentionally prints the eval summary */
import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cases } from './cases';
import { generatePlanForEval } from './generate';
import { judgePlan, lastJudgeUsage, JUDGE_MODEL } from './judge';
import { runChecks, criticalFailures } from './checks';

// Live eval (paid). Skipped unless RUN_LIVE_EVAL=1 so normal `vitest run` and CI
// stay free. Run it with: `npm run eval:plan` (or the nightly GitHub Action).
//
// Gate:
//   - ZERO safety-critical deterministic failures across the golden set, AND
//   - LM-judge pass rate >= JUDGE_PASS_THRESHOLD.
// A failure exits non-zero, which fails the nightly / pre-release job.

const LIVE = process.env.RUN_LIVE_EVAL === '1';
const JUDGE_PASS_THRESHOLD = 0.85;
// EVAL_REPORT_FILE lets model comparisons write side by side (default report.json).
const REPORT_FILE = process.env.EVAL_REPORT_FILE?.trim() || 'report.json';

/** USD per 1M tokens, developers.openai.com/api/docs/pricing, checked 2026-11-23. */
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-6.2-sol': { input: 2, output: 10 },
  'gpt-6.1-terra': { input: 1, output: 5 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
};

function costUsd(model: string, usage: { inputTokens: number; outputTokens: number } | null): number | null {
  const price = PRICES_PER_MTOK[model];
  if (!price || !usage) return null;
  // Reasoning tokens are already inside outputTokens and bill as output.
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

describe.runIf(LIVE)('plan-generator live eval', () => {
  // Without this, a missing key surfaces as `AI_APICallError: Incorrect API key
  // provided: ''` from deep inside the SDK, which reads like a plan-generator
  // regression. It is not: it is a setup gap. The nightly job failed 25 straight
  // runs on exactly this and nobody could tell from the error what was wrong.
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is not set, so this eval cannot run. This is a setup gap, ' +
          'NOT a plan-generator quality regression.\n' +
          '  CI:    add the repo secret -> gh secret set OPENAI_API_KEY\n' +
          '  Local: add OPENAI_API_KEY to v0/.env.local (gitignored)'
      );
    }
  });

  it(
    'meets safety and quality gates across the golden set',
    async () => {
      const report: Array<Record<string, unknown>> = [];

      // EVAL_CASE_IDS=a,b runs a subset (re-checks after a prompt fix); default all.
      const only = process.env.EVAL_CASE_IDS?.split(',').map((x) => x.trim()).filter(Boolean);
      const selected = only?.length ? cases.filter((c) => only.includes(c.id)) : cases;
      for (const c of selected) {
        const gen = await generatePlanForEval(c.request, undefined, c.advancedMetrics);
        const checks = runChecks(gen.plan, c, gen.source);
        const crit = criticalFailures(checks);
        const verdict = await judgePlan(c, gen.plan);
        const judgeUsage = lastJudgeUsage;
        report.push({
          id: c.id,
          description: c.description,
          source: gen.source,
          genError: gen.error,
          model: gen.model,
          latencyMs: gen.latencyMs,
          usage: gen.usage,
          costUsd: costUsd(gen.model, gen.usage),
          judgeModel: JUDGE_MODEL,
          judgeUsage,
          judgeCostUsd: costUsd(JUDGE_MODEL, judgeUsage),
          criticalFailures: crit.map((x) => `${x.id}: ${x.detail}`),
          checks,
          verdict,
          plan: gen.plan,
        });
      }

      const dir = join(process.cwd(), 'evals', 'plan-generator');
      mkdirSync(dir, { recursive: true });
      const judgePassCount = report.filter(
        (r) => (r.verdict as { overallPass: boolean; safety: number }).overallPass &&
          (r.verdict as { safety: number }).safety >= 4
      ).length;
      const judgePassRate = judgePassCount / report.length;
      const criticalCases = report.filter((r) => (r.criticalFailures as string[]).length > 0);
      const fallbackCases = report.filter((r) => r.source === 'fallback');
      const latencies = report.map((r) => r.latencyMs as number);
      const usages = report.map((r) => r.usage as { inputTokens: number; outputTokens: number; reasoningTokens: number } | null);
      const sum = (f: (u: { inputTokens: number; outputTokens: number; reasoningTokens: number }) => number) =>
        usages.reduce((n, u) => n + (u ? f(u) : 0), 0);
      const costs = report.map((r) => r.costUsd as number | null).filter((v): v is number => v !== null);
      const judgeScores = report.map((r) => r.verdict as Record<string, number>);
      const avg = (k: string) => judgeScores.reduce((n, v) => n + (v[k] ?? 0), 0) / judgeScores.length;
      const metrics = {
        model: report[0]?.model,
        judgeModel: JUDGE_MODEL,
        latencyP50Ms: percentile(latencies, 50),
        latencyP95Ms: percentile(latencies, 95),
        inputTokens: sum((u) => u.inputTokens),
        outputTokens: sum((u) => u.outputTokens),
        reasoningTokens: sum((u) => u.reasoningTokens),
        costPerPlanUsd: costs.length ? Number((costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(5)) : null,
        judgeAvg: {
          safety: Number(avg('safety').toFixed(2)),
          personalization: Number(avg('personalization').toFixed(2)),
          progression: Number(avg('progression').toFixed(2)),
          rationaleClarity: Number(avg('rationaleClarity').toFixed(2)),
          actionability: Number(avg('actionability').toFixed(2)),
        },
      };

      writeFileSync(
        resolve(dir, REPORT_FILE),
        JSON.stringify(
          {
            feature: 'plan-generator',
            caseCount: report.length,
            judgePassRate: Number(judgePassRate.toFixed(3)),
            judgePassThreshold: JUDGE_PASS_THRESHOLD,
            fallbackCases: fallbackCases.map((r) => r.id),
            criticalFailureCases: criticalCases.map((r) => r.id),
            metrics,
            cases: report,
          },
          null,
          2
        )
      );

      console.log(
        `[plan-eval] cases=${report.length} judgePassRate=${(judgePassRate * 100).toFixed(0)}% fallbacks=${fallbackCases.length} criticalFailureCases=${criticalCases.length}`
      );
      console.log(`[plan-eval] metrics ${JSON.stringify(metrics)}`);
      if (fallbackCases.length > 0) {
        console.log(`  FALLBACK (AI generation failed, served deterministic plan): ${fallbackCases.map((r) => r.id).join(', ')}`);
      }
      for (const r of criticalCases) {
        console.log(`  CRITICAL ${r.id}: ${(r.criticalFailures as string[]).join('; ')}`);
      }

      expect(
        criticalCases.map((r) => r.id),
        'safety-critical deterministic checks failed'
      ).toEqual([]);
      expect(judgePassRate).toBeGreaterThanOrEqual(JUDGE_PASS_THRESHOLD);
    },
    // 12 sequential plans; reasoning models can take over a minute per long plan.
    1_800_000
  );
});
