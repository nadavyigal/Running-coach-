import { Worker } from 'bullmq';
import { processAiActivity } from '../jobs/ai-activity';
import { logger } from '../utils/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined
};

export const workers = [
  new Worker('ai-activity', processAiActivity, {
    connection,
    concurrency: 3,
    limiter: { max: 10, duration: 60000 },
    settings: {
      backoffStrategy: (attemptsMade) => Math.min(Math.pow(2, attemptsMade) * 1000, 30000)
    }
  })
];

workers.forEach(worker => {
  worker.on('completed', (job) => {
    logger.info('Job completed', { queue: worker.name, jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job?.id, error: err.message });
  });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing workers...');
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
});
