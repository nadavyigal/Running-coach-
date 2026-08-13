/* eslint-disable no-console -- this runner intentionally prints the eval summary */
import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cases } from './cases';
import { generatePlanForEval } from './generate';
import { judgePlan } from './judge';
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

      for (const c of cases) {
        const gen = await generatePlanForEval(c.request);
        const checks = runChecks(gen.plan, c);
        const crit = criticalFailures(checks);
        const verdict = await judgePlan(c, gen.plan);
        report.push({
          id: c.id,
          description: c.description,
          source: gen.source,
          genError: gen.error,
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

      writeFileSync(
        join(dir, 'report.json'),
        JSON.stringify(
          {
            feature: 'plan-generator',
            caseCount: report.length,
            judgePassRate: Number(judgePassRate.toFixed(3)),
            judgePassThreshold: JUDGE_PASS_THRESHOLD,
            fallbackCases: fallbackCases.map((r) => r.id),
            criticalFailureCases: criticalCases.map((r) => r.id),
            cases: report,
          },
          null,
          2
        )
      );

      console.log(
        `[plan-eval] cases=${report.length} judgePassRate=${(judgePassRate * 100).toFixed(0)}% fallbacks=${fallbackCases.length} criticalFailureCases=${criticalCases.length}`
      );
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
    600_000
  );
});
