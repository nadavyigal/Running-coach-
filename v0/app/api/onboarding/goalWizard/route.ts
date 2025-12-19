import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { NextRequest } from "next/server"
import { logger } from "@/lib/logger"

interface OnboardingSession {
  conversationId: string
  goalDiscoveryPhase: 'motivation' | 'assessment' | 'creation' | 'refinement' | 'complete'
  discoveredGoals: any[]
  coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging'
}

interface GoalData {
  type: string
  value: number
  unit: string
  description: string
  category: 'speed' | 'endurance' | 'consistency' | 'health' | 'strength'
  priority: 1 | 2 | 3
  specificTarget: {
    metric: string
    value: number
    unit: string
    description: string
  }
  measurableOutcome: {
    successCriteria: string[]
    trackingMethod: string
    measurementFrequency: 'daily' | 'weekly' | 'monthly'
  }
  achievabilityAssessment: {
    difficultyRating: number
    requiredResources: string[]
    potentialObstacles: string[]
    mitigationStrategies: string[]
  }
  relevanceJustification: {
    personalImportance: number
    alignmentWithValues: string
    motivationalFactors: string[]
  }
  timeBound: {
    startDate: Date
    deadline: Date
    milestoneSchedule: number[]
    estimatedDuration: number
  }
}

const PHASE_PROMPTS = {
  motivation: `You are an empathetic AI running coach helping a new user discover their running motivations. 
  
  Your role is to:
  - Ask open-ended questions about why they want to start running
  - Explore their lifestyle, constraints, and current situation
  - Identify personality indicators for coaching style
  - Be encouraging and supportive
  - Keep responses concise (2-3 sentences max)
  
  Current conversation context: {conversation}
  
  Respond naturally and guide the conversation toward understanding their motivations.`,

  assessment: `You are an AI running coach assessing a user's running experience and capabilities.
  
  Your role is to:
  - Ask about previous running/fitness experience
  - Understand what worked/didn't work in the past
  - Assess current physical activity level
  - Explore time availability and schedule constraints
  - Identify potential barriers and challenges
  - Keep responses concise and encouraging
  
  Current conversation context: {conversation}
  
  Guide the conversation to understand their starting point and capabilities.`,

  creation: `You are an AI running coach helping create SMART running goals.
  
  Based on the conversation so far, help the user create specific, measurable, achievable, relevant, and time-bound goals.
  
  Your role is to:
  - Transform motivations into specific objectives
  - Set realistic timelines based on experience level
  - Create accountability measures
  - Identify potential obstacles and solutions
  - Suggest 2-3 primary goals with supporting goals
  - Keep responses encouraging and actionable
  
  Current conversation context: {conversation}
  
  Help them create concrete, achievable running goals.`,

  refinement: `You are an AI running coach refining and finalizing running goals.
  
  Your role is to:
  - Review and refine the proposed goals
  - Ensure they are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
  - Adjust timelines if needed
  - Add supporting goals and milestones
  - Confirm user commitment and excitement
  - Prepare for plan generation
  
  Current conversation context: {conversation}
  
  Finalize their goals and prepare for the next step.`
}

const GOAL_TEMPLATES = {
  habit: {
    title: "Build a Consistent Running Habit",
    description: "Establish a sustainable running routine",
    category: "consistency" as const,
    specificTarget: {
      metric: "runs per week",
      value: 3,
      unit: "runs",
      description: "Run 3 times per week consistently"
    },
    measurableOutcome: {
      successCriteria: ["Complete 3 runs per week for 4 consecutive weeks"],
      trackingMethod: "Weekly run count tracking",
      measurementFrequency: "weekly" as const
    },
    timeBound: {
      startDate: new Date(),
      deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
      milestoneSchedule: [25, 50, 75],
      estimatedDuration: 28
    }
  },
  distance: {
    title: "Complete Your First 5K",
    description: "Train to run 5 kilometers without stopping",
    category: "endurance" as const,
    specificTarget: {
      metric: "distance",
      value: 5,
      unit: "kilometers",
      description: "Run 5K without walking"
    },
    measurableOutcome: {
      successCriteria: ["Complete a 5K run", "Maintain conversation pace"],
      trackingMethod: "Distance tracking and pace monitoring",
      measurementFrequency: "weekly" as const
    },
    timeBound: {
      startDate: new Date(),
      deadline: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000), // 12 weeks
      milestoneSchedule: [25, 50, 75],
      estimatedDuration: 84
    }
  },
  speed: {
    title: "Improve Your Running Pace",
    description: "Increase your running speed and efficiency",
    category: "speed" as const,
    specificTarget: {
      metric: "pace",
      value: 30,
      unit: "seconds per km improvement",
      description: "Improve pace by 30 seconds per kilometer"
    },
    measurableOutcome: {
      successCriteria: ["Reduce average pace by 30 seconds/km", "Maintain good form"],
      trackingMethod: "Pace tracking and time trials",
      measurementFrequency: "weekly" as const
    },
    timeBound: {
      startDate: new Date(),
      deadline: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000), // 8 weeks
      milestoneSchedule: [25, 50, 75],
      estimatedDuration: 56
    }
  }
}

function analyzeUserResponse(
  userMessage: string,
  _phase: string,
  session?: OnboardingSession
): any {
  // Simple keyword analysis for coaching style detection
  const supportiveKeywords = ['nervous', 'anxious', 'worried', 'scared', 'unsure', 'beginner', 'first time']
  const challengingKeywords = ['competitive', 'challenge', 'push', 'hard', 'intense', 'ambitious']
  const analyticalKeywords = ['data', 'numbers', 'metrics', 'track', 'measure', 'analyze', 'progress']
  const encouragingKeywords = ['excited', 'motivated', 'ready', 'confident', 'positive', 'determined']

  let coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging' = session?.coachingStyle || 'supportive'
  
  const message = userMessage.toLowerCase()
  if (challengingKeywords.some(keyword => message.includes(keyword))) {
    coachingStyle = 'challenging'
  } else if (analyticalKeywords.some(keyword => message.includes(keyword))) {
    coachingStyle = 'analytical'
  } else if (supportiveKeywords.some(keyword => message.includes(keyword))) {
    coachingStyle = 'supportive'
  } else if (encouragingKeywords.some(keyword => message.includes(keyword)) && coachingStyle === 'supportive') {
    coachingStyle = 'supportive'
  }

  return { coachingStyle }
}

function generateGoalsFromConversation(messages: any[], session: OnboardingSession): GoalData[] {
  const goals: GoalData[] = []
  
  // Analyze conversation for goal indicators
  const conversation = messages.map(m => m.content).join(' ').toLowerCase()
  
  // Detect goal types from conversation
  if (conversation.includes('habit') || conversation.includes('consistent') || conversation.includes('routine')) {
    const habitGoal: GoalData = {
      type: "habit",
      value: 3,
      unit: "runs per week",
      description: "Build a Consistent Running Habit",
      category: "consistency",
      priority: 1,
      specificTarget: {
        metric: "runs per week",
        value: 3,
        unit: "runs",
        description: "Run 3 times per week consistently"
      },
      measurableOutcome: {
        successCriteria: ["Complete 3 runs per week for 4 consecutive weeks"],
        trackingMethod: "Weekly run count tracking",
        measurementFrequency: "weekly"
      },
      achievabilityAssessment: {
        difficultyRating: 4,
        requiredResources: ["Running shoes", "Time commitment"],
        potentialObstacles: ["Weather", "Time constraints", "Motivation"],
        mitigationStrategies: ["Schedule runs in advance", "Find running buddy", "Track progress"]
      },
      relevanceJustification: {
        personalImportance: 8,
        alignmentWithValues: "Building healthy habits",
        motivationalFactors: ["Health improvement", "Stress relief", "Energy boost"]
      },
      timeBound: {
        startDate: new Date(),
        deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
        milestoneSchedule: [25, 50, 75],
        estimatedDuration: 28
      }
    }
    goals.push(habitGoal)
  }
  
  if (conversation.includes('5k') || conversation.includes('distance') || conversation.includes('longer')) {
    const distanceGoal: GoalData = {
      type: "distance",
      value: 5,
      unit: "kilometers",
      description: "Complete Your First 5K",
      category: "endurance",
      priority: 1,
      specificTarget: {
        metric: "distance",
        value: 5,
        unit: "kilometers",
        description: "Run 5K without walking"
      },
      measurableOutcome: {
        successCriteria: ["Complete a 5K run", "Maintain conversation pace"],
        trackingMethod: "Distance tracking and pace monitoring",
        measurementFrequency: "weekly"
      },
      achievabilityAssessment: {
        difficultyRating: 6,
        requiredResources: ["Running shoes", "Training plan", "Time for longer runs"],
        potentialObstacles: ["Building endurance", "Time for long runs", "Injury risk"],
        mitigationStrategies: ["Gradual progression", "Proper warm-up", "Recovery days"]
      },
      relevanceJustification: {
        personalImportance: 9,
        alignmentWithValues: "Achievement and fitness",
        motivationalFactors: ["Race completion", "Fitness milestone", "Personal achievement"]
      },
      timeBound: {
        startDate: new Date(),
        deadline: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000), // 12 weeks
        milestoneSchedule: [25, 50, 75],
        estimatedDuration: 84
      }
    }
    goals.push(distanceGoal)
  }
  
  if (conversation.includes('faster') || conversation.includes('pace') || conversation.includes('speed')) {
    const speedGoal: GoalData = {
      type: "speed",
      value: 30,
      unit: "seconds per km improvement",
      description: "Improve Your Running Pace",
      category: "speed",
      priority: 1,
      specificTarget: {
        metric: "pace",
        value: 30,
        unit: "seconds per km improvement",
        description: "Improve pace by 30 seconds per kilometer"
      },
      measurableOutcome: {
        successCriteria: ["Reduce average pace by 30 seconds/km", "Maintain good form"],
        trackingMethod: "Pace tracking and time trials",
        measurementFrequency: "weekly"
      },
      achievabilityAssessment: {
        difficultyRating: 7,
        requiredResources: ["Running shoes", "Speed training knowledge", "Recovery time"],
        potentialObstacles: ["Injury risk", "Overtraining", "Plateau periods"],
        mitigationStrategies: ["Gradual progression", "Proper form", "Adequate recovery"]
      },
      relevanceJustification: {
        personalImportance: 8,
        alignmentWithValues: "Performance improvement",
        motivationalFactors: ["Personal records", "Competition", "Fitness gains"]
      },
      timeBound: {
        startDate: new Date(),
        deadline: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000), // 8 weeks
        milestoneSchedule: [25, 50, 75],
        estimatedDuration: 56
      }
    }
    goals.push(speedGoal)
  }

  // Default to habit goal if no specific goals detected
  if (goals.length === 0) {
    const defaultGoal: GoalData = {
      type: "habit",
      value: 3,
      unit: "runs per week",
      description: "Build a Consistent Running Habit",
      category: "consistency",
      priority: 1,
      specificTarget: {
        metric: "runs per week",
        value: 3,
        unit: "runs",
        description: "Run 3 times per week consistently"
      },
      measurableOutcome: {
        successCriteria: ["Complete 3 runs per week for 4 consecutive weeks"],
        trackingMethod: "Weekly run count tracking",
        measurementFrequency: "weekly"
      },
      achievabilityAssessment: {
        difficultyRating: 4,
        requiredResources: ["Running shoes", "Time commitment"],
        potentialObstacles: ["Weather", "Time constraints", "Motivation"],
        mitigationStrategies: ["Schedule runs in advance", "Find running buddy", "Track progress"]
      },
      relevanceJustification: {
        personalImportance: 8,
        alignmentWithValues: "Building healthy habits",
        motivationalFactors: ["Health improvement", "Stress relief", "Energy boost"]
      },
      timeBound: {
        startDate: new Date(),
        deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
        milestoneSchedule: [25, 50, 75],
        estimatedDuration: 28
      }
    }
    goals.push(defaultGoal)
  }

  return goals
}

export async function POST(req: NextRequest) {
  try {
    const { messages, session, currentPhase } = await req.json()

    if (!messages || !Array.isArray(messages) || !session) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    const userMessage = messages[messages.length - 1]?.content || ''
    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n')

    // Analyze user response for coaching style
    const analysis = analyzeUserResponse(userMessage, currentPhase, session)

    // Determine next phase based on conversation progress
    let nextPhase = currentPhase
    let goals: GoalData[] = []
    let userProfile: any = {}

    if (currentPhase === 'motivation' && messages.length >= 4) {
      nextPhase = 'assessment'
    } else if (currentPhase === 'assessment' && messages.length >= 8) {
      nextPhase = 'creation'
    } else if (currentPhase === 'creation' && messages.length >= 12) {
      nextPhase = 'refinement'
      goals = generateGoalsFromConversation(messages, session)
    } else if (currentPhase === 'refinement' && messages.length >= 14) {
      nextPhase = 'complete'
      goals = generateGoalsFromConversation(messages, session)
      
      // Generate user profile based on conversation
      userProfile = {
        goal: goals[0]?.category === 'endurance' ? 'distance' : 
              goals[0]?.category === 'speed' ? 'speed' : 'habit',
        experience: 'beginner', // Default, could be refined based on conversation
        preferredTimes: ['morning'], // Default
        daysPerWeek: 3, // Default
        motivations: [], // Extract from conversation
        barriers: [], // Extract from conversation
        coachingStyle: analysis.coachingStyle
      }
    }

    // Generate AI response based on current phase
    const phasePrompt = PHASE_PROMPTS[currentPhase as keyof typeof PHASE_PROMPTS]
    const systemPrompt = phasePrompt.replace('{conversation}', conversation)

    const result = await streamText({
      model: openai("gpt-4o"),
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-3) // Last 3 messages for context
      ],
      maxOutputTokens: 200,
      temperature: 0.7,
    })

    const response = await result.text

    // Prepare response data
    const responseData = {
      response,
      nextPhase,
      goals: nextPhase === 'complete' || nextPhase === 'refinement' ? goals : [],
      userProfile: nextPhase === 'complete' ? userProfile : {},
      coachingStyle: analysis.coachingStyle
    }

    return new Response(JSON.stringify(responseData), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    logger.error('GoalWizard API error:', error)
    
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred. Please try again." 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
} 
