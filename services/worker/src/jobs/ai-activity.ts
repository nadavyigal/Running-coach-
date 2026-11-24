import { Job } from 'bullmq';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import sharp from 'sharp';
import { z } from 'zod';
import type { AiActivityJobData, AiActivityResult } from '../../shared/types/jobs';
import { logger } from '../utils/logger';
import { captureAIGeneration } from '../utils/ai-observability';

/**
 * Vision model. Same env vars as v0/lib/ai/models.ts (this package cannot import
 * it): OPENAI_MODEL_VISION, default gpt-4o; target gpt-6.1-terra. Reasoning ids
 * run at OPENAI_REASONING_EFFORT_VISION (default none).
 */
const VISION_MODEL = process.env.OPENAI_MODEL_VISION?.trim() || 'gpt-4o';
const VISION_EFFORT = (() => {
  // Same lowest-accepted-effort rules as normalizeEffort in v0/lib/ai/models.ts.
  const effort = process.env.OPENAI_REASONING_EFFORT_VISION?.trim() || 'none';
  const id = VISION_MODEL.toLowerCase();
  const low = effort === 'none' || effort === 'minimal';
  if (low && (/^gpt-6\.2-sol/.test(id) || /^o\d/.test(id))) return 'low';
  if (effort === 'none' && /^gpt-5(-|$)/.test(id)) return 'minimal';
  return effort;
})();
const VISION_PROVIDER_OPTIONS = /^(o\d|gpt-5|gpt-6)/i.test(VISION_MODEL)
  ? { openai: { reasoningEffort: VISION_EFFORT } }
  : undefined;

const activitySchema = z.object({
  type: z.string().optional(),
  distance_km: z.number().positive(),
  duration_seconds: z.number().positive(),
  pace_seconds_per_km: z.number().optional(),
  calories: z.number().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
  confidence: z.number().min(0).max(100).optional()
});

export async function processAiActivity(job: Job<AiActivityJobData>): Promise<AiActivityResult> {
  const startTime = Date.now();
  const { imageBuffer, mimeType, userId, requestId } = job.data;

  logger.info('Processing AI activity', { jobId: job.id, requestId });

  try {
    // Step 1: Image preprocessing with Sharp
    await job.updateProgress(10);

    const processedImage = await sharp(Buffer.from(imageBuffer, 'base64'))
      .resize({ width: 1600, withoutEnlargement: true })
      .rotate() // EXIF rotation
      .grayscale()
      .normalize()
      .sharpen()
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    await job.updateProgress(40);

    // Step 2: GPT-4o Vision analysis
    const imageUrl = `data:image/jpeg;base64,${processedImage.toString('base64')}`;

    const prompt = 'Extract running activity data from this image';
    const generationStartedAt = Date.now();
    const generation = await generateObject({
      model: openai(VISION_MODEL),
      providerOptions: VISION_PROVIDER_OPTIONS,
      schema: activitySchema as any,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: imageUrl }
        ]
      }]
    });
    const { object: extracted } = generation;

    await captureAIGeneration({
      traceName: 'ai-activity',
      distinctId: userId,
      model: VISION_MODEL,
      input: prompt,
      output: extracted,
      usage: (generation as any).usage,
      latencyMs: Date.now() - generationStartedAt,
      properties: {
        request_id: requestId,
        job_id: job.id,
        worker: true,
        streaming: false
      }
    });

    await job.updateProgress(90);

    // Step 3: Normalize result
    const result: AiActivityResult = {
      success: true,
      activity: {
        type: extracted.type || 'run',
        distanceKm: extracted.distance_km,
        durationSeconds: extracted.duration_seconds,
        paceSecondsPerKm: extracted.pace_seconds_per_km,
        calories: extracted.calories,
        notes: extracted.notes,
        completedAtIso: extracted.date || new Date().toISOString(),
        confidencePct: extracted.confidence || 75
      },
      requestId,
      processingTime: Date.now() - startTime
    };

    await job.updateProgress(100);
    logger.info('AI activity completed', { jobId: job.id, requestId });

    return result;

  } catch (error) {
    await captureAIGeneration({
      traceName: 'ai-activity',
      distinctId: userId,
      model: VISION_MODEL,
      input: 'Extract running activity data from this image',
      latencyMs: Date.now() - startTime,
      error,
      properties: {
        request_id: requestId,
        job_id: job.id,
        worker: true,
        streaming: false
      }
    });
    logger.error('AI activity failed', { jobId: job.id, error });
    throw error;
  }
}
