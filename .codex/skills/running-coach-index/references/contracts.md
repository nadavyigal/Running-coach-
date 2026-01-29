# Shared Contracts

Use these canonical shapes across skills. Extend with additional optional fields per skill as needed, but keep base keys stable.

```ts
interface UserProfile {
  userId: number;
  name?: string;
  goal: Goal;
  experience: 'beginner' | 'intermediate' | 'advanced';
  schedule?: string[];
  units?: 'metric' | 'imperial';
  injuryFlags?: string[];
  preferences?: Record<string, string | number | boolean>;
}

type Goal = 'habit' | 'distance' | 'speed' | 'race';

interface TrainingHistory {
  recentRuns: RecentRunTelemetry[];
  weeklyVolumeKm?: number;
  longRunDistanceKm?: number;
  consistencyScore?: number; // 0-1
}

interface RecentRunTelemetry {
  runId: number;
  date: string; // ISO
  distanceKm: number;
  durationMinutes: number;
  avgPace?: string;
  hrZones?: Record<string, number>;
  rpe?: number;
  surface?: string;
  weatherTag?: string;
  notes?: string;
}

interface Plan {
  userId: number;
  startDate: string; // ISO
  days: Workout[];
  rationale?: string;
  version?: string;
}

interface Workout {
  date: string; // ISO
  sessionType: 'easy' | 'tempo' | 'intervals' | 'long' | 'rest' | 'cross' | 'race';
  durationMinutes?: number;
  targetPace?: string;
  targetHrZone?: string;
  notes?: string;
  tags?: string[];
}

interface Adjustment {
  date: string; // ISO
  change: 'intensity' | 'volume' | 'swap' | 'rest-day' | 'cross-train' | 'cancel';
  previousSession: string;
  newSession: string;
  rationale: string;
  safetyFlags?: SafetyFlag[];
}

interface Insight {
  runId: number;
  summary: string[];
  effort: 'easy' | 'moderate' | 'hard';
  metrics?: Record<string, string>;
  recovery?: RecoveryRecommendation;
  nextSessionNudge?: string;
  safetyFlags?: SafetyFlag[];
}

interface RecoveryRecommendation {
  priority: string[];
  optional?: string[];
}

interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO
}

interface CoachMessage {
  message: string;
  tone?: 'supportive' | 'direct' | 'celebratory';
  cta?: string;
}

interface SafetyFlag {
  code: 'load_spike' | 'injury_signal' | 'heat_risk' | 'missing_data' | 'uncertain';
  severity: 'low' | 'medium' | 'high';
  message: string;
}
```
