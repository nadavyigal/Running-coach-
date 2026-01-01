// Job payload types (input to workers)
export interface AiActivityJobData {
  imageBuffer: string;  // base64
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  userId: string;
  requestId: string;
}

export interface GeneratePlanJobData {
  userId: number;
  userContext: {
    goal: 'habit' | 'distance' | 'speed';
    experience: 'beginner' | 'intermediate' | 'advanced';
    daysPerWeek: number;
  };
}

export interface ChatJobData {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: number;
}

// Job result types (output from workers)
export interface AiActivityResult {
  success: boolean;
  activity?: {
    type: string;
    distanceKm: number;
    durationSeconds: number;
    paceSecondsPerKm?: number;
    calories?: number;
    notes?: string;
    completedAtIso?: string;
    confidencePct: number;
  };
  requestId: string;
  processingTime: number;
  error?: string;
}

export interface GeneratePlanResult {
  success: boolean;
  plan?: {
    title: string;
    description: string;
    totalWeeks: number;
    workouts: Array<any>;
  };
  source: 'ai' | 'fallback';
  error?: string;
}

export interface ChatResult {
  success: boolean;
  response?: string;
  conversationId?: string;
  tokenCount?: number;
  error?: string;
}
