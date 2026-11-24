/* eslint-disable no-console -- this runner intentionally prints the smoke table */
/**
 * Live model smoke: 5 fixed inputs per WRITER / FAST call site, run once with the
 * current models and once with the target models. Paid; skipped unless
 * RUN_LIVE_SMOKE=1.
 *
 *   RUN_LIVE_SMOKE=1 npx vitest run --config evals/model-smoke/vitest.smoke.config.ts
 *   RUN_LIVE_SMOKE=1 OPENAI_MODEL_WRITER=gpt-6.1-terra OPENAI_MODEL_FAST=gpt-6-luna \
 *     npx vitest run --config evals/model-smoke/vitest.smoke.config.ts
 *
 * Each site uses the production model selection, output cap, temperature and
 * schema. Prompts are the production ones: imported where exported, otherwise
 * read from the route file at runtime (route files may not export extra names),
 * so there is no copied prompt to drift. Two zod schemas live inline in route
 * handlers and are copied below, marked as copies.
 *
 * Not covered: app/api/run-report (its InsightSchema and prompt are private to the
 * route handler and depend on a normalized run plus history).
 */
import { describe, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import sharp from 'sharp';
import { providerOptionsFor, selectModel, type ModelSelection } from '@/lib/ai/models';
import { OnboardingPromptBuilder } from '@/lib/onboardingPromptBuilder';
import { buildInsightPrompts } from '@/lib/garminInsightBuilder';
import { CoachingResponseSchema, RecommendationSchema } from '@/lib/adaptiveCoachingEngine';
import { chatDriver } from '@/lib/chatDriver';

const LIVE = process.env.RUN_LIVE_SMOKE === '1';
const root = path.resolve(__dirname, '../..');

function routeTemplate(file: string, name: string, key?: string): string {
  const src = readFileSync(path.join(root, file), 'utf8');
  const pattern = key
    ? new RegExp(`${key}: \`([\\s\\S]*?)\``)
    : new RegExp(`const ${name} = \`([\\s\\S]*?)\``);
  const match = src.match(pattern);
  if (!match) throw new Error(`template ${name}${key ? '.' + key : ''} not found in ${file}`);
  return match[1];
}

interface Usage { inputTokens: number; outputTokens: number; reasoningTokens: number }
interface Row { site: string; tier: string; model: string; input: string; ok: boolean; detail: string; ms: number; usage: Usage }

function usageOf(u: any): Usage {
  return { inputTokens: u?.inputTokens ?? 0, outputTokens: u?.outputTokens ?? 0, reasoningTokens: u?.reasoningTokens ?? 0 };
}

const QUESTIONS = [
  'How should I pace my first 10K race?',
  'My left knee aches after long runs. Should I keep training?',
  'What should I eat the night before a half marathon?',
  'How many easy runs per week for a beginner?',
  'איך לשפר את הקצב שלי ב-5 ק"מ?',
];

const WORKOUTS = [
  'Create a Tempo Run workout for 10K at intermediate difficulty level.',
  'Create a Interval workout for 5K at advanced difficulty level.',
  'Create a Long Run workout for half marathon at beginner difficulty level.',
  'Create a Hill Repeats workout for general fitness at intermediate difficulty level.',
  'Create a Recovery Run workout for marathon at beginner difficulty level.',
];

const CUES = [
  'Current pace: 6.2 min/km, Target pace: 5.8 min/km, Goal: tempo',
  'Current pace: 5.1 min/km, Target pace: 5.5 min/km, Goal: easy, Heart rate: 168 bpm',
  'Current pace: 4.4 min/km, Goal: intervals, Heart rate: 176 bpm',
  'Current pace: 7.0 min/km, Goal: long run',
  'Current pace: 5.6 min/km, Target pace: 5.6 min/km, Heart rate: 150 bpm',
];

const PHOTOS = [
  { km: 5.02, sec: 1661 },
  { km: 10.0, sec: 3125 },
  { km: 21.1, sec: 7380 },
  { km: 3.2, sec: 1140 },
  { km: 8.45, sec: 2890 },
];

// Copy of the inline schema in app/api/goals/discovery/route.ts (getAIGoalInsights).
const aiInsightsSchema = z.object({
  suitabilityAnalysis: z.object({
    recommendedGoalTypes: z.array(z.string()),
    priorityRanking: z.array(z.string()),
    avoidGoalTypes: z.array(z.string()),
    reasonings: z.array(z.string()),
  }),
  personalizationInsights: z.object({
    experienceAdjustments: z.string(),
    timelineConsiderations: z.string(),
    motivationalFactors: z.array(z.string()),
    coachingStyleAlignment: z.string(),
  }),
  riskAssessment: z.object({
    primaryBarriers: z.array(z.string()),
    successFactors: z.array(z.string()),
    safetyConsiderations: z.array(z.string()),
    mitigationStrategies: z.array(z.string()),
  }),
  specificRecommendations: z.array(z.object({
    goalType: z.string(),
    title: z.string(),
    description: z.string(),
    targetValue: z.number(),
    targetUnit: z.string(),
    timeline: z.number(),
    reasoning: z.string(),
    confidence: z.number(),
  })),
  overallConfidence: z.number(),
  additionalNotes: z.string(),
});

// Copy of the inline schema in app/api/analysis/run-from-photo/route.ts.
const extractedRunSchema = z
  .object({
    distanceKm: z.number(),
    durationSeconds: z.number(),
    runType: z.enum(['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'other']),
    notes: z.string().optional(),
  })
  .strict();

function fmt(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

async function runPhoto(km: number, sec: number): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#111"/>
  <text x="30" y="70" font-size="34" fill="#fff" font-family="Helvetica">Morning Run</text>
  <text x="30" y="160" font-size="28" fill="#ccc" font-family="Helvetica">Distance</text><text x="300" y="160" font-size="40" fill="#fff" font-family="Helvetica">${km.toFixed(2)} km</text>
  <text x="30" y="240" font-size="28" fill="#ccc" font-family="Helvetica">Time</text><text x="300" y="240" font-size="40" fill="#fff" font-family="Helvetica">${fmt(sec)}</text>
  <text x="30" y="320" font-size="28" fill="#ccc" font-family="Helvetica">Avg Pace</text><text x="300" y="320" font-size="40" fill="#fff" font-family="Helvetica">${fmt(Math.round(sec / km))} /km</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

describe.runIf(LIVE)('model smoke (WRITER / FAST call sites)', () => {
  it('runs 5 fixed inputs per call site', async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    const rows: Row[] = [];
    const record = async (site: string, sel: ModelSelection, input: string, fn: () => Promise<{ ok: boolean; detail: string; usage: any }>) => {
      const t = Date.now();
      try {
        const r = await fn();
        rows.push({ site, tier: sel.tier, model: sel.model, input, ok: r.ok, detail: r.detail.slice(0, 140), ms: Date.now() - t, usage: usageOf(r.usage) });
      } catch (error) {
        rows.push({ site, tier: sel.tier, model: sel.model, input, ok: false, detail: `error: ${String(error).slice(0, 160)}`, ms: Date.now() - t, usage: usageOf(null) });
      }
      const last = rows[rows.length - 1];
      console.log(JSON.stringify({ site, ok: last.ok, ms: last.ms, detail: last.detail.slice(0, 100) }));
    };

    const writer = selectModel('WRITER');
    const fast = selectModel('FAST');
    console.log(`[smoke] WRITER=${writer.model} (${writer.reasoningEffort ?? '-'}) FAST=${fast.model} (${fast.reasoningEffort ?? '-'})`);

    const chatSystem = routeTemplate('app/api/chat/route.ts', 'SYSTEM_PROMPT');
    const chatModel = selectModel('WRITER', { overrideEnv: ['OPENAI_MODEL'] });
    for (const q of QUESTIONS) {
      await record('chat', chatModel, q, async () => {
        const r = await generateText({ model: openai(chatModel.model), providerOptions: providerOptionsFor(chatModel), system: chatSystem, prompt: q, maxOutputTokens: 500, temperature: 0.7 });
        return { ok: r.text.trim().length > 40 && r.finishReason !== 'length', detail: `${r.finishReason}: ${r.text}`, usage: r.usage };
      });
    }

    const workoutSystem = routeTemplate('app/api/workouts/generate/route.ts', 'SYSTEM_PROMPT');
    for (const w of WORKOUTS) {
      await record('workouts/generate', writer, w, async () => {
        const r = await generateText({ model: openai(writer.model), providerOptions: providerOptionsFor(writer), system: workoutSystem, prompt: w, maxOutputTokens: 700, temperature: 0.7 });
        const start = r.text.indexOf('{'), end = r.text.lastIndexOf('}');
        let ok = false;
        try { ok = start >= 0 && Array.isArray(JSON.parse(r.text.slice(start, end + 1)).phases); } catch { ok = false; }
        return { ok, detail: `${r.finishReason} json=${ok}`, usage: r.usage };
      });
    }

    for (const q of QUESTIONS) {
      await record('onboarding/chat', writer, q, async () => {
        const system = OnboardingPromptBuilder.buildPrompt('motivation', [], 'Runner, 34, runs twice a week');
        const r = await generateText({ model: openai(writer.model), providerOptions: providerOptionsFor(writer), messages: [{ role: 'system', content: system }, { role: 'user', content: q }], maxOutputTokens: 300, temperature: 0.7 });
        return { ok: r.text.trim().length > 20 && r.finishReason !== 'length', detail: `${r.finishReason}: ${r.text}`, usage: r.usage };
      });
    }

    const wizard = routeTemplate('app/api/onboarding/goalWizard/route.ts', 'PHASE_PROMPTS', 'motivation');
    for (const q of QUESTIONS) {
      await record('onboarding/goalWizard', writer, q, async () => {
        const r = await generateText({ model: openai(writer.model), providerOptions: providerOptionsFor(writer), messages: [{ role: 'system', content: wizard.replace('{conversation}', `user: ${q}`) }, { role: 'user', content: q }], maxOutputTokens: 200, temperature: 0.7 });
        return { ok: r.text.trim().length > 20 && r.finishReason !== 'length', detail: `${r.finishReason}: ${r.text}`, usage: r.usage };
      });
    }

    for (const q of QUESTIONS) {
      await record('goals/discovery', writer, q, async () => {
        const r = await generateObject({ model: openai(writer.model), providerOptions: providerOptionsFor(writer), schema: aiInsightsSchema, prompt: `Suggest running goals for a 34 year old intermediate runner, 25 km/week, 4 days/week. Context: ${q}`, temperature: 0.7, maxOutputTokens: 2000 });
        return { ok: r.object.specificRecommendations.length > 0, detail: `recs=${r.object.specificRecommendations.length}`, usage: r.usage };
      });
    }

    const coaching = selectModel('WRITER', { overrideEnv: ['CHAT_COACHING_MODEL', 'CHAT_DEFAULT_MODEL'] });
    for (const q of QUESTIONS) {
      await record('adaptiveCoaching.response', coaching, q, async () => {
        const r = await generateObject({ model: openai(coaching.model), providerOptions: providerOptionsFor(coaching), schema: CoachingResponseSchema, prompt: `You are a running coach. Answer: ${q}`, temperature: 0.7, maxOutputTokens: 800 });
        return { ok: r.object.response.length > 20, detail: r.object.response, usage: r.usage };
      });
    }
    for (const q of QUESTIONS) {
      await record('adaptiveCoaching.recommendations', coaching, q, async () => {
        const r = await generateObject({ model: openai(coaching.model), providerOptions: providerOptionsFor(coaching), schema: RecommendationSchema, prompt: `Give adaptive training recommendations for a runner. Recent feedback: ${q}`, temperature: 0.6, maxOutputTokens: 900 });
        return { ok: r.object.recommendations.length > 0, detail: `recs=${r.object.recommendations.length}`, usage: r.usage };
      });
    }

    const insight = selectModel('FAST', { overrideEnv: ['OPENAI_MODEL'] });
    for (let i = 0; i < 5; i += 1) {
      const weekly = i % 2 === 1;
      const prompts = buildInsightPrompts({
        type: weekly ? 'weekly' : 'daily',
        periodStart: '2026-11-16',
        periodEnd: '2026-11-22',
        confidence: 'medium',
        safetyFlags: i === 3 ? ['ACWR above 1.5'] : [],
        sections: [],
        promptSummary: `readiness ${55 + i * 8}/100, sleep score ${60 + i * 5}, HRV ${i - 2 > 0 ? '+' : ''}${(i - 2) * 4}% vs baseline, weekly ${20 + i * 6} km, ACWR ${(0.9 + i * 0.15).toFixed(2)}`,
        tokenEstimate: 120,
      } as any);
      await record('garmin-insights', insight, `case-${i}`, async () => {
        const r = await generateText({ model: openai(insight.model), providerOptions: providerOptionsFor(insight), messages: [{ role: 'system', content: prompts.systemPrompt }, { role: 'user', content: prompts.userPrompt }], maxOutputTokens: 280, temperature: 0.35 });
        return { ok: r.text.includes('This is not medical advice') && r.finishReason !== 'length', detail: `${r.finishReason}: ${r.text}`, usage: r.usage };
      });
    }

    const cueSystem = routeTemplate('app/api/coach/voice-cue/route.ts', 'COACH_SYSTEM_PROMPT');
    for (const c of CUES) {
      await record('coach/voice-cue (text)', fast, c, async () => {
        const r = await generateText({ model: openai(fast.model), providerOptions: providerOptionsFor(fast), system: cueSystem, prompt: c, maxOutputTokens: 60 });
        const words = r.text.trim().split(/\s+/).length;
        return { ok: r.text.trim().length > 0 && words <= 40 && r.finishReason !== 'length', detail: `${r.finishReason} words=${words}: ${r.text}`, usage: r.usage };
      });
    }

    const driverModel = selectModel('FAST', { overrideEnv: ['CHAT_DEFAULT_MODEL'] });
    for (const q of QUESTIONS) {
      await record('chatDriver', driverModel, q, async () => {
        const r = await chatDriver.ask({ messages: [{ role: 'user', content: q }], maxTokens: 300 } as any);
        return { ok: r.success && (r.data?.response.length ?? 0) > 20, detail: r.success ? r.data!.response : String(r.error?.message), usage: { inputTokens: r.data?.tokensIn, outputTokens: r.data?.tokensOut } };
      });
    }

    for (const p of PHOTOS) {
      await record('analysis/run-from-photo', fast, `${p.km}km ${p.sec}s`, async () => {
        const image = await runPhoto(p.km, p.sec);
        const r = await generateObject({
          model: openai(fast.model),
          providerOptions: providerOptionsFor(fast),
          schema: extractedRunSchema,
          prompt: [{ role: 'user', content: [
            { type: 'text', text: 'You are analyzing a photo or screenshot of a running activity. Extract the total distance in kilometers, total duration in seconds, classify the run type (easy, tempo, intervals, long, time-trial, hill, other), and provide any relevant notes to prefill a manual run form. Return concise values only.' },
            { type: 'image', image },
          ] }],
        });
        const ok = Math.abs(r.object.distanceKm - p.km) < 0.06 && Math.abs(r.object.durationSeconds - p.sec) <= 2;
        return { ok, detail: `${r.object.distanceKm}km ${r.object.durationSeconds}s`, usage: r.usage };
      });
    }

    const bySite = new Map<string, Row[]>();
    for (const r of rows) bySite.set(r.site, [...(bySite.get(r.site) ?? []), r]);
    const lines = ['| Site | Model | Valid | p50 ms | max ms | in tok | out tok | reasoning tok |', '|---|---|---|---|---|---|---|---|'];
    for (const [site, list] of bySite) {
      const ms = list.map((r) => r.ms).sort((a, b) => a - b);
      const sum = (k: keyof Usage) => list.reduce((n, r) => n + (r.usage[k] ?? 0), 0);
      lines.push(`| ${site} | ${list[0].model} | ${list.filter((r) => r.ok).length}/${list.length} | ${ms[2]} | ${ms[ms.length - 1]} | ${sum('inputTokens')} | ${sum('outputTokens')} | ${sum('reasoningTokens')} |`);
    }
    console.log(lines.join('\n'));
    if (process.env.SMOKE_OUT) writeFileSync(process.env.SMOKE_OUT, JSON.stringify(rows, null, 2));
  });
});
