export interface PerformanceTrend {
  metric: 'distance' | 'pace' | 'duration' | 'frequency'
  trend: 'improving' | 'declining' | 'stable'
  value: number
  period: 'week' | 'month' | 'quarter'
}

export interface UserPreferences {
  name?: string
  coachingStyle?: 'encouraging' | 'technical' | 'motivational' | 'educational'
}

export interface Run {
  id?: number
  distance: number
  duration: number
}

export interface Plan {
  id?: number
  name?: string
}

export interface AICoachContext {
  userId: string
  recentRuns: Run[]
  currentPlan?: Plan | null
  performanceTrends: PerformanceTrend[]
  userPreferences: UserPreferences
  coachingStyle: 'encouraging' | 'technical' | 'motivational' | 'educational'
}

export interface FollowUpAction {
  action: string
}

export interface AICoachResponse {
  response: string
  suggestedQuestions: string[]
  followUpActions: FollowUpAction[]
  confidence: number
  contextUsed: string[]
}

export async function generateContextAwareResponse(
  message: string,
  context: AICoachContext
): Promise<AICoachResponse> {
  try {
    const lastRun = context.recentRuns[context.recentRuns.length - 1]
    const name = context.userPreferences.name || 'runner'
    const runInfo = lastRun
      ? `your last run was ${lastRun.distance}km in ${Math.round(
          lastRun.duration / 60
        )} min`
      : 'you have no recent runs'
    const response = `Hi ${name}, ${runInfo}. ${message}`
    return {
      response,
      suggestedQuestions: ['How did you feel?', 'Ready for the next workout?'],
      followUpActions: [],
      confidence: 0.9,
      contextUsed: ['recentRuns', 'userPreferences']
    }
  } catch (error) {
    return {
      response: 'Sorry, I could not generate a coaching response.',
      suggestedQuestions: [],
      followUpActions: [],
      confidence: 0,
      contextUsed: []
    }
  }
}
