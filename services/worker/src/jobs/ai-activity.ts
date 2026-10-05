import { Job } from 'bullmq';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import sharp from 'sharp';
import { z } from 'zod';
import type { AiActivityJobData, AiActivityResult } from '../../shared/types/jobs';
import { logger } from '../utils/logger';

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

    const { object: extracted } = await generateObject({
      model: openai('gpt-4o'),
      schema: activitySchema,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract running activity data from this image' },
          { type: 'image', image: imageUrl }
        ]
      }]
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
    logger.error('AI activity failed', { jobId: job.id, error });
    throw error;
  }
}
