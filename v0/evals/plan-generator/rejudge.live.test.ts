/* eslint-disable no-console -- prints the agreement summary */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { cases } from './cases';
import { judgePlan } from './judge';
import type { PlanData } from '@/lib/plan/plan-core';

// Re-judge a finished plan-eval report with another judge model, on the SAME
// plans, so a judge change is measured apart from generation variance. Paid;
// skipped unless RUN_REJUDGE=1.
//
//   RUN_LIVE_EVAL=1 RUN_REJUDGE=1 EVAL_REJUDGE_REPORT=/path/report.json EVAL_REJUDGE_MODEL=gpt-4o-mini \
//     npx vitest run --config evals/plan-generator/vitest.eval.config.ts evals/plan-generator/rejudge.live.test.ts

const LIVE = process.env.RUN_REJUDGE === '1';
const REPORT = process.env.EVAL_REJUDGE_REPORT ?? '';
const MODEL = process.env.EVAL_REJUDGE_MODEL?.trim() || 'gpt-4o-mini';

interface CaseRow {
  id: string;
  plan: PlanData;
  verdict: { overallPass: boolean; safety: number; personalization: number; progression: number };
}

describe.runIf(LIVE)(`plan-eval rejudge with ${MODEL}`, () => {
  it('re-judges every case of the report', async () => {
    expect(REPORT).not.toBe('');
    const report = JSON.parse(readFileSync(REPORT, 'utf8')) as { cases: CaseRow[] };
    const rows: Array<Record<string, unknown>> = [];
    let agree = 0;
    const pass = (v: CaseRow['verdict']) => v.overallPass && v.safety >= 4;
    for (const row of report.cases) {
      const c = cases.find((x) => x.id === row.id);
      if (!c) continue;
      const v = await judgePlan(c, row.plan, MODEL);
      if (pass(v) === pass(row.verdict)) agree += 1;
      rows.push({ id: row.id, original: row.verdict, rejudged: v });
    }
    const avg = (k: 'safety' | 'personalization' | 'progression') =>
      Number((rows.reduce((n, r) => n + (r.rejudged as CaseRow['verdict'])[k], 0) / rows.length).toFixed(2));
    const summary = {
      model: MODEL,
      compared: rows.length,
      gateAgreement: `${agree}/${rows.length}`,
      judgePass: rows.filter((r) => pass(r.rejudged as CaseRow['verdict'])).length,
      safety: avg('safety'),
      personalization: avg('personalization'),
      progression: avg('progression'),
    };
    writeFileSync(REPORT.replace(/\.json$/, `.rejudge-${MODEL}.json`), JSON.stringify({ summary, rows }, null, 2));
    console.log(`[rejudge] ${JSON.stringify(summary)}`);
    expect(rows.length).toBeGreaterThan(0);
  }, 1_800_000);
});
