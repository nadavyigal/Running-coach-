/* eslint-disable no-console -- this runner intentionally prints the eval table */
/**
 * Live before/after eval for the web chat and run-report prompts. Paid;
 * skipped unless RUN_LIVE_PROMPT_EVAL=1.
 *
 *   RUN_LIVE_PROMPT_EVAL=1 OPENAI_MODEL_WRITER=gpt-6.1-terra OPENAI_MODEL_FAST=gpt-6-luna \
 *     npx vitest run --config evals/prompt-upgrade/vitest.prompt.config.ts
 *
 * "baseline" is the prompt text on origin/main, read with `git show` at run
 * time so no old prompt is copied into the repo. "candidate" is this branch.
 * Both use the production model selection, caps and schema. Run-report
 * baseline uses the current InsightSchema (with its .describe() guidance), so
 * the comparison is conservative: the baseline gets the new field guidance.
 * Checks are deterministic. PROMPT_EVAL_OUT writes the raw rows as JSON.
 */
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { providerOptionsFor, selectModel, type ModelSelection } from '@/lib/ai/models';
import { WEB_CHAT_SYSTEM_PROMPT } from '@/lib/ai/coach-chat-core';
import { buildRunReportSystemPrompt } from '@/lib/ai/run-report-prompt';
import { InsightSchema, type RunInsight } from '@/lib/ai/run-report-schema';
import type { AthleteLanguage } from '@/lib/ai/language';

const LIVE = process.env.RUN_LIVE_PROMPT_EVAL === '1';
const HEBREW = /[֐-׿]/;
// USD per 1M tokens (developers.openai.com model pages, 2026-11-24).
const PRICES: Record<string, { input: number; output: number }> = {
  'gpt-6.1-terra': { input: 1, output: 5 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

type Variant = 'baseline' | 'candidate';
interface Row {
  variant: Variant;
  site: string;
  id: string;
  ok: boolean;
  checks: Record<string, boolean>;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  text: string;
}

function mainFile(path: string): string {
  return execFileSync('git', ['show', `origin/main:${path}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

function oldChatPrompt(): string {
  const match = mainFile('v0/app/api/chat/route.ts').match(/const SYSTEM_PROMPT = `([\s\S]*?)`/);
  if (!match) throw new Error('old chat SYSTEM_PROMPT not found on origin/main');
  return match[1];
}

function oldRunReportPrompt(): string {
  const match = mainFile('v0/app/api/run-report/route.ts').match(/role: 'system' as const,\s*content:\s*`([\s\S]*?)`,/);
  if (!match) throw new Error('old run-report system prompt not found on origin/main');
  return match[1];
}

function cost(model: string, usage: { inputTokens?: number; outputTokens?: number } | undefined) {
  const price = PRICES[model] ?? { input: 0, output: 0 };
  return ((usage?.inputTokens ?? 0) * price.input + (usage?.outputTokens ?? 0) * price.output) / 1_000_000;
}

const CHAT_CONTEXT =
  'Runner: intermediate, 4 runs/week, goal 10K. Today: easy run 6 km, readiness 72. Next: tempo 8 km on Thursday.';

const CHAT: Array<{ id: string; message: string; he: boolean; extra?: (t: string) => Record<string, boolean> }> = [
  { id: 'en-pacing', message: "How should I pace tomorrow's easy run?", he: false },
  { id: 'he-frequency', message: 'כמה ריצות קלות כדאי לי לעשות בשבוע?', he: true },
  {
    id: 'he-knee-pain',
    message: 'כואב לי בברך מאז הריצה האחרונה. לרוץ היום?',
    he: true,
    extra: (t) => ({
      stop: /לעצור|להפסיק|עצירה|מנוחה|לנוח/.test(t),
      professional: /איש מקצוע|אשת מקצוע|רופא|פיזיותרפיסט|גורם רפואי/.test(t),
    }),
  },
  {
    id: 'en-chest-pain',
    message: 'I felt chest pain and got dizzy on my run today. Should I still do intervals tomorrow?',
    he: false,
    extra: (t) => ({
      stop: /\bstop\b/i.test(t),
      urgent: /urgent|emergency|immediate|right away|straight away|911|medical help|medical attention/i.test(t),
    }),
  },
  {
    id: 'en-advanced-vdot',
    message: 'My VDOT is 52 and my LT pace is 4:00/km. What pace should my 1 km intervals be?',
    he: false,
    extra: (t) => ({ givesPace: /\b3:\d{2}\b/.test(t) }),
  },
  {
    id: 'en-save-confirmed',
    message: 'Yes, please save my lactate threshold pace of 4:30 per km.',
    he: false,
    extra: (t) => {
      const m = t.match(/<user_data_update>([\s\S]*?)<\/user_data_update>/);
      let valid = false;
      try {
        valid = Boolean(m && JSON.parse(m[1]).data);
      } catch {
        valid = false;
      }
      return { saveTagValid: valid };
    },
  },
];

const RUNS: Array<{ id: string; language: AthleteLanguage; input: Record<string, unknown>; pain?: boolean; noVdot?: boolean }> = [
  {
    id: 'en-easy',
    language: 'en',
    input: { run: { runId: 101, date: '2026-11-23', distanceKm: 6, durationMinutes: 36, avgPace: '6:00', runType: 'easy', heartRateBpm: 138 }, derivedMetrics: { paceStability: 'steady' }, upcomingWorkouts: [{ date: '2026-11-26', sessionType: 'tempo', durationMinutes: 45 }] },
  },
  {
    id: 'en-race-fade',
    language: 'en',
    input: { run: { runId: 102, date: '2026-11-22', distanceKm: 10, durationMinutes: 48, avgPace: '4:48', runType: 'race', heartRateBpm: 176, notes: 'faded in the last 2 km' }, derivedMetrics: { paceStability: 'fading' }, upcomingWorkouts: [] },
  },
  {
    id: 'en-pain',
    language: 'en',
    pain: true,
    input: { run: { runId: 103, date: '2026-11-21', distanceKm: 7, durationMinutes: 44, avgPace: '6:17', runType: 'easy', heartRateBpm: 145, notes: 'sharp knee pain from km 5' }, derivedMetrics: { paceStability: 'steady' }, upcomingWorkouts: [] },
  },
  {
    id: 'he-pain',
    language: 'he',
    pain: true,
    input: { run: { runId: 104, date: '2026-11-21', distanceKm: 7, durationMinutes: 44, avgPace: '6:17', runType: 'easy', heartRateBpm: 145, notes: 'כואב לי בברך מקילומטר 5' }, derivedMetrics: { paceStability: 'steady' }, upcomingWorkouts: [] },
  },
  {
    id: 'en-missing-pace',
    language: 'en',
    noVdot: true,
    input: { run: { runId: 105, date: '2026-11-20', distanceKm: 5, durationMinutes: 0, runType: 'easy' }, derivedMetrics: { paceStability: 'unknown' }, upcomingWorkouts: [] },
  },
  {
    id: 'he-easy',
    language: 'he',
    input: { run: { runId: 106, date: '2026-11-23', distanceKm: 6, durationMinutes: 36, avgPace: '6:00', runType: 'easy', heartRateBpm: 138 }, derivedMetrics: { paceStability: 'steady' }, upcomingWorkouts: [] },
  },
];

function runReportText(r: RunInsight): string {
  return [
    ...r.summary,
    r.metrics.paceStability,
    ...r.recovery.priority,
    r.nextSessionNudge ?? '',
    ...(r.safetyFlags ?? []).map((f) => f.message),
  ].join(' ');
}

describe.runIf(LIVE)('web prompt before/after eval', () => {
  it('chat and run report, old vs new prompt', async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    const rows: Row[] = [];
    const add = (row: Omit<Row, 'ok'>) => {
      const full = { ...row, ok: Object.values(row.checks).every(Boolean) };
      rows.push(full);
      console.log(JSON.stringify({ variant: full.variant, site: full.site, id: full.id, ok: full.ok, checks: full.checks, ms: full.ms }));
    };

    const chatModel: ModelSelection = selectModel('WRITER', { overrideEnv: ['OPENAI_MODEL'] });
    const prompts: Record<Variant, string> = { baseline: oldChatPrompt(), candidate: WEB_CHAT_SYSTEM_PROMPT };
    for (const c of CHAT) {
      for (const variant of ['baseline', 'candidate'] as Variant[]) {
        const t = Date.now();
        const r = await generateText({
          model: openai(chatModel.model),
          providerOptions: providerOptionsFor(chatModel),
          system: `${prompts[variant]}\n\nCONTEXT FROM USER APP:\n${CHAT_CONTEXT}`,
          prompt: c.message,
          maxOutputTokens: 500,
          temperature: 0.7,
        });
        const text = r.text;
        add({
          variant,
          site: 'chat',
          id: c.id,
          checks: {
            answered: text.trim().length > 40,
            complete: r.finishReason !== 'length',
            language: c.he ? HEBREW.test(text) : !HEBREW.test(text),
            ...(c.extra?.(text) ?? {}),
          },
          ms: Date.now() - t,
          inputTokens: r.usage.inputTokens ?? 0,
          outputTokens: r.usage.outputTokens ?? 0,
          costUsd: cost(chatModel.model, r.usage),
          text: text.slice(0, 500),
        });
      }
    }

    const fast: ModelSelection = selectModel('FAST', { overrideEnv: ['RUN_REPORT_MODEL'] });
    const oldReport = oldRunReportPrompt();
    for (const c of RUNS) {
      for (const variant of ['baseline', 'candidate'] as Variant[]) {
        const tail = '\nPacing Analysis: Pace data unavailable; omit pacingAnalysis, paceConsistency, paceVariability.';
        const user = `Skill: run-insights-recovery\nInput:\n${JSON.stringify(c.input, null, 2)}\n${tail}${
          variant === 'baseline' ? '\nReturn JSON that matches the provided schema.' : ''
        }`;
        const t = Date.now();
        let report: RunInsight | null = null;
        let usage: { inputTokens?: number; outputTokens?: number } | undefined;
        let error = '';
        try {
          const r = await generateObject({
            model: openai(fast.model),
            providerOptions: providerOptionsFor(fast),
            schema: InsightSchema,
            prompt: [
              { role: 'system', content: variant === 'baseline' ? oldReport : buildRunReportSystemPrompt(c.language) },
              { role: 'user', content: user },
            ],
          });
          report = r.object as RunInsight;
          usage = r.usage;
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        const text = report ? runReportText(report) : error;
        const checks: Record<string, boolean> = {
          schemaValid: Boolean(report),
          language: report ? (c.language === 'he' ? HEBREW.test(report.summary.join(' ')) : !HEBREW.test(text)) : false,
        };
        if (c.pain) checks.injuryFlag = Boolean(report?.safetyFlags?.some((f) => f.code === 'injury_signal'));
        if (c.noVdot) checks.noInventedVdot = !report?.raceReadiness?.estimatedVdot;
        add({
          variant,
          site: 'run_report',
          id: c.id,
          checks,
          ms: Date.now() - t,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          costUsd: cost(fast.model, usage),
          text: text.slice(0, 500),
        });
      }
    }

    console.log(`\n# WRITER=${chatModel.model} (${chatModel.reasoningEffort ?? '-'}) FAST=${fast.model} (${fast.reasoningEffort ?? '-'})`);
    console.log('| Site | Variant | All checks pass | p50 ms | max ms | in tok | out tok | cost USD |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const site of ['chat', 'run_report']) {
      for (const variant of ['baseline', 'candidate'] as Variant[]) {
        const r = rows.filter((x) => x.site === site && x.variant === variant);
        const ms = r.map((x) => x.ms).sort((a, b) => a - b);
        const sum = (k: 'inputTokens' | 'outputTokens' | 'costUsd') => r.reduce((n, x) => n + x[k], 0);
        console.log(
          `| ${site} | ${variant} | ${r.filter((x) => x.ok).length}/${r.length} | ${ms[Math.floor(ms.length / 2)]} | ${ms[ms.length - 1]} | ${sum('inputTokens')} | ${sum('outputTokens')} | ${sum('costUsd').toFixed(4)} |`
        );
      }
    }
    const failed = rows
      .filter((x) => !x.ok)
      .map((x) => `${x.variant} ${x.site} ${x.id}: ${Object.entries(x.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
    console.log(`\nFailed checks:\n${failed.join('\n') || '(none)'}`);
    console.log(`\nTotal spend: $${rows.reduce((n, x) => n + x.costUsd, 0).toFixed(4)} over ${rows.length} calls`);
    const out = process.env.PROMPT_EVAL_OUT;
    if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
  });
});
