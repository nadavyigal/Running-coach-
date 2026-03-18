/**
 * API Endpoint Paths
 *
 * Centralized enumeration of all API routes in the RunSmart application.
 * These paths are shared between web and iOS clients.
 */

export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_SIGNUP: '/api/auth/signup',
  AUTH_SESSION: '/api/auth/session',

  // Chat / AI Coach
  CHAT: '/api/chat',
  CHAT_PING: '/api/chat/ping',
  CHAT_SIMPLE: '/api/chat-simple',
  CHAT_TEST: '/api/chat-test',

  // Plan Generation
  GENERATE_PLAN: '/api/generate-plan',
  ONBOARDING: '/api/onboarding',

  // Run Analysis
  RUN_REPORT: '/api/run-report',
  RUN_FROM_PHOTO: '/api/analysis/run-from-photo',

  // Goals
  GOALS: '/api/goals',
  GOALS_BY_ID: (id: number) => `/api/goals/${id}`,
  GOAL_MILESTONES: (goalId: number) => `/api/goals/${goalId}/milestones`,
  GOAL_PROGRESS: (goalId: number) => `/api/goals/${goalId}/progress`,
  GOAL_RECOMMENDATIONS: '/api/goals/recommendations',

  // Coaching
  COACHING_PROFILE: '/api/coaching/profile',
  COACHING_FEEDBACK: '/api/coaching/feedback',
  COACHING_RECOMMENDATIONS: '/api/coaching/adaptive-recommendations',
  COACHING_INTERACTIONS: '/api/coaching/interactions',

  // Recovery
  RECOVERY: '/api/recovery',
  RECOVERY_SCORE: '/api/recovery/score',
  SLEEP_DATA: '/api/recovery/sleep',
  HRV_DATA: '/api/recovery/hrv',
  SUBJECTIVE_WELLNESS: '/api/recovery/wellness',

  // Devices
  DEVICES: '/api/devices',
  DEVICE_SYNC: (deviceId: number) => `/api/devices/${deviceId}/sync`,
  DEVICE_CONNECT: '/api/devices/connect',
  DEVICE_DISCONNECT: (deviceId: number) => `/api/devices/${deviceId}/disconnect`,

  // Routes
  ROUTES: '/api/routes',
  ROUTE_RECOMMENDATIONS: '/api/routes/recommendations',
  ROUTE_PREFERENCES: '/api/routes/preferences',

  // Challenges
  CHALLENGES: '/api/challenges',
  CHALLENGE_TEMPLATES: '/api/challenges/templates',
  CHALLENGE_PROGRESS: (challengeId: number) => `/api/challenges/${challengeId}/progress`,
  CHALLENGE_START: '/api/challenges/start',

  // Analytics
  ANALYTICS_EVENTS: '/api/analytics/events',
  ANALYTICS_METRICS: '/api/analytics/metrics',
  ANALYTICS_RETENTION: '/api/analytics/retention',
  ANALYTICS_COHORTS: '/api/analytics/cohorts',
  ANALYTICS_AB_TESTS: '/api/analytics/ab-tests',
  ANALYTICS_FEATURE_FLAGS: '/api/analytics/feature-flags',

  // Beta Signup
  BETA_SIGNUP: '/api/beta-signup',

  // AI Activity
  AI_ACTIVITY: '/api/ai-activity',

  // Habit Analytics
  HABIT_ANALYTICS: '/api/habit-analytics',
  HABIT_INSIGHTS: '/api/habit-analytics/insights',
  HABIT_PATTERNS: '/api/habit-analytics/patterns',

  // Performance
  PERFORMANCE_METRICS: '/api/performance/metrics',
  PERSONAL_RECORDS: '/api/performance/records',
  PERFORMANCE_INSIGHTS: '/api/performance/insights',

  // Subscriptions (Pro plan gating)
  SUBSCRIPTION_STATUS: '/api/subscription/status',
  SUBSCRIPTION_UPGRADE: '/api/subscription/upgrade',
  SUBSCRIPTION_CANCEL: '/api/subscription/cancel',

  // Workouts and Plans
  PLANS: '/api/plans',
  PLAN_BY_ID: (planId: number) => `/api/plans/${planId}`,
  PLAN_WORKOUTS: (planId: number) => `/api/plans/${planId}/workouts`,
  PLAN_FEEDBACK: (planId: number) => `/api/plans/${planId}/feedback`,

  // Runs
  RUNS: '/api/runs',
  RUN_BY_ID: (runId: number) => `/api/runs/${runId}`,

  // User Profile
  USER_PROFILE: '/api/user/profile',
  USER_PREFERENCES: '/api/user/preferences',
  USER_STATS: '/api/user/stats',

  // Shoes
  SHOES: '/api/shoes',
  SHOE_BY_ID: (shoeId: number) => `/api/shoes/${shoeId}`,
} as const;

export type ApiEndpoint = typeof API_ENDPOINTS;
