/**
 * @runsmart/shared
 *
 * Shared TypeScript types and contracts for RunSmart web (Next.js) and iOS (Swift) apps.
 *
 * This package serves as the single source of truth for data models and API contracts,
 * ensuring type safety and consistency across platforms.
 */

// Re-export all models
export * from './models/user';
export * from './models/plan';
export * from './models/run';
export * from './models/recovery';
export * from './models/goal';
export * from './models/coaching';
export * from './models/device';
export * from './models/challenge';
export * from './models/route';
export * from './models/metrics';

// Re-export API contracts
export * from './api/endpoints';
export * from './api/types';
