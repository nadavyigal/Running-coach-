import './processors/main';
import './health';
import { logger } from './utils/logger';

logger.info('Worker service started', {
  redis: process.env.REDIS_URL,
  env: process.env.NODE_ENV
});
