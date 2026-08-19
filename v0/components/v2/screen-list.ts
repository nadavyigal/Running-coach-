export type V2Screen =
  | 'onboarding'
  | 'today'
  | 'plan'
  | 'run'
  | 'profile'
  | 'routes'
  | 'goals'
  | 'integrations';

export const SCREEN_LIST: ReadonlyArray<{ id: V2Screen; label: string }> = [
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'today', label: 'Today · AI Coach' },
  { id: 'plan', label: 'Plan' },
  { id: 'run', label: 'Run · Live' },
  { id: 'profile', label: 'Profile' },
  { id: 'routes', label: 'Routes' },
  { id: 'goals', label: 'Goals & Challenges' },
  { id: 'integrations', label: 'Connect' },
];
