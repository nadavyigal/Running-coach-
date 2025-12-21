import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { CoachingProfile, CoachingFeedback } from './db';
import { dbUtils } from '@/lib/dbUtils';

// Context interfaces
export interface UserContext {
  currentGoals: string[];
  recentActivity: string;
  mood?: 'energetic' | 'tired' | 'motivated' | 'stressed' | 'neutral';
  environment?: 'indoor' | 'outdoor' | 'gym' | 'home';
  timeConstraints?: string;
  weather?: {
    condition: 'sunny' | 'cloudy' | 'rain' | 'snow' | 'windy';
    temperature: number;
    humidity?: number;
  };
  schedule?: {
    hasTime: boolean;
    preferredDuration?: number;
    flexibility: 'high' | 'medium' | 'low';
  };
}

export interface CoachingResponse {
  response: string;
  confidence: number;
  adaptations: string[];
  requestFeedback: boolean;
  interactionId: string;
  contextUsed: string[];
  suggestedActions?: string[];
  /**
   * Indicates the engine could not generate a fully personalized response
   * (e.g. upstream AI failure) and used a degraded fallback.
   */
  fallback?: boolean;
  /**
   * Optional machine-readable reason for fallback (safe to log).
   */
  fallbackReason?: string;
}

export interface AdaptiveRecommendation {
  type: 'workout_modification' | 'schedule_optimization' | 'motivation' | 'technique_improvement';
  title: string;
  description: string;
  confidence: number;
  reasoning: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  contextualFactors: string[];
}

// Response schema for structured generation
const CoachingResponseSchema = z.object({
  response: z.string().describe('The main coaching response'),
  confidence: z.number().min(0).max(1).describe('Confidence in the response (0-1)'),
  keyPoints: z.array(z.string()).describe('Key takeaways from the response'),
  actionableAdvice: z.array(z.string()).describe('Specific actions the user should take'),
  motivationalElements: z.array(z.string()).describe('Motivational aspects included'),
  technicalDetails: z.array(z.string()).optional().describe('Technical details provided'),
  followUpQuestions: z.array(z.string()).optional().describe('Questions to engage the user further')
});

const RecommendationSchema = z.object({
  recommendations: z.array(z.object({
    type: z.enum(['workout_modification', 'schedule_optimization', 'motivation', 'technique_improvement']),
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    actionSteps: z.array(z.string())
  })),
  contextualInsights: z.object({
    primaryFactors: z.array(z.string()),
    adaptationsMade: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  })
});

export class AdaptiveCoachingEngine {
  private static instance: AdaptiveCoachingEngine;
  
  static getInstance(): AdaptiveCoachingEngine {
    if (!this.instance) {
      this.instance = new AdaptiveCoachingEngine();
    }
    return this.instance;
  }

  /**
   * Generate personalized coaching response based on user profile and context
   */
  async generatePersonalizedResponse(
    userId: number,
    query: string,
    context: UserContext,
    options?: { throwOnError?: boolean }
  ): Promise<CoachingResponse> {
    try {
      const profile = (await dbUtils.getCoachingProfile(userId)) ?? undefined;
      const adaptedPrompt = await this.adaptPromptToProfile(query, profile, context);
      const interactionId = this.generateInteractionId();

      const modelName =
        process.env.CHAT_COACHING_MODEL ||
        process.env.CHAT_DEFAULT_MODEL ||
        'gpt-4o';
      
      // Generate structured response using AI
      const result = await generateObject({
        model: openai(modelName),
        schema: CoachingResponseSchema,
        prompt: adaptedPrompt,
        temperature: 0.7,
        maxOutputTokens: 800,
      });

      const response: CoachingResponse = {
        response: result.object.response,
        confidence: result.object.confidence,
        adaptations: this.getAppliedAdaptations(profile),
        requestFeedback: this.shouldRequestFeedback(profile),
        interactionId,
        contextUsed: this.getContextFactors(context),
        suggestedActions: result.object.actionableAdvice
      };

      // Record the interaction for learning
      await this.recordInteraction(userId, response, context, adaptedPrompt);
      
      return response;
    } catch (error) {
      console.error('Error generating personalized response:', error);

      if (options?.throwOnError) {
        throw error;
      }
      
      // Fallback response
      return {
        response: "I'm here to help you with your running goals. Could you tell me more about what you're looking for?",
        confidence: 0,
        adaptations: [],
        requestFeedback: false,
        interactionId: this.generateInteractionId(),
        contextUsed: [],
        suggestedActions: [],
        fallback: true,
        fallbackReason: 'adaptive_coaching_error',
      };
    }
  }

  /**
   * Generate adaptive recommendations based on user patterns and context
   */
  async generateAdaptiveRecommendations(
    userId: number,
    context: UserContext
  ): Promise<AdaptiveRecommendation[]> {
    try {
      const profile = (await dbUtils.getCoachingProfile(userId)) ?? undefined;
      const patterns = await dbUtils.getBehaviorPatterns(userId);
      const recentFeedback = await dbUtils.getCoachingFeedback(userId, 10);
      
      const recommendationPrompt = this.buildRecommendationPrompt(profile, patterns, recentFeedback, context);

      const modelName =
        process.env.CHAT_COACHING_MODEL ||
        process.env.CHAT_DEFAULT_MODEL ||
        'gpt-4o';
      
      const result = await generateObject({
        model: openai(modelName),
        schema: RecommendationSchema,
        prompt: recommendationPrompt,
        temperature: 0.6,
        maxOutputTokens: 900,
      });

      return result.object.recommendations.map(rec => ({
        type: rec.type,
        title: rec.title,
        description: rec.description,
        confidence: rec.confidence,
        reasoning: rec.reasoning,
        actionable: rec.actionSteps.length > 0,
        priority: rec.priority,
        contextualFactors: result.object.contextualInsights.primaryFactors
      }));
    } catch (error) {
      console.error('Error generating adaptive recommendations:', error);
      return [];
    }
  }

  /**
   * Process feedback and adapt coaching profile
   */
  async processFeedback(
    userId: number,
    feedback: Omit<CoachingFeedback, 'id' | 'userId' | 'createdAt'>
  ): Promise<void> {
    try {
      // Record the feedback
      await dbUtils.recordCoachingFeedback({
        userId,
        ...feedback
      });

      // Analyze patterns in feedback
      await this.analyzeFeedbackPatterns(userId);
      
      // Update coaching effectiveness
      await this.updateCoachingEffectiveness(userId);
    } catch (error) {
      console.error('Error processing feedback:', error);
    }
  }

  /**
   * Get the core coaching knowledge base for nutrition, recovery, and training zones
   */
  private getCoachingKnowledgeBase(): string {
    return `
## NUTRITION ENGINE KNOWLEDGE

### Pre-Run Fueling:
- Easy/short runs (<60 min): 0.5g carbs/kg body weight 1-2 hours before
- Long runs (>60 min) or hard workouts: 1.0g carbs/kg body weight 2-3 hours before

### Intra-Run Fueling:
- <60 minutes: Water only, 300mg sodium/L
- 60-89 minutes: 30g carbs/hour, water + electrolytes
- 90-180 minutes: 60g carbs/hour, glucose/fructose mix
- >180 minutes: 90g carbs/hour, high-carb mix
- Hydration: 500-750ml per hour

### Post-Run Recovery Nutrition:
- Protein: 0.25-0.30g/kg within 30 minutes
- Carbs for runs <45min: 0.6g/kg; 46-89min: 0.8g/kg; >90min: 1.0g/kg

## RECOVERY PROTOCOL KNOWLEDGE

### Readiness Tiers:
- Low (0-49): Reduce intensity, focus on recovery
- Moderate (50-74): Standard training with monitoring
- High (75-100): Optimal for key workouts

### ACWR Guidelines:
- <0.8: Increase load 5-10%
- 0.8-1.3: Optimal range
- 1.3-1.5: Reduce or hold steady
- >1.5: Prioritize recovery

## TRAINING ZONES (Karvonen %HRR):
- Z1 (55-72%): Recovery, RPE 2-3
- Z2 (72-82%): Aerobic base, RPE 3-4
- Z3 (82-89%): Tempo, RPE 5-6
- Z4 (89-95%): VO2max, RPE 7-8
- Z5 (95-100%): Anaerobic, RPE 9+

80/20 rule: 80% easy (Z1-Z2), 20% hard (Z3-Z5)`;
  }

  /**
   * Adapt prompt based on user profile and context
   */
  private async adaptPromptToProfile(
    query: string,
    profile: CoachingProfile | undefined,
    context: UserContext
  ): Promise<string> {
    const knowledgeBase = this.getCoachingKnowledgeBase();
    
    if (!profile) {
      return `You are an expert AI endurance running coach following the AI Endurance Coach Master Protocol. 
${knowledgeBase}

The user asks: "${query}". Provide helpful, motivational guidance with specific, actionable advice.`;
    }

    let adaptedPrompt = `You are an AI running coach following the AI Endurance Coach Master Protocol with the following adaptation for this specific user:
${knowledgeBase}

Communication Style:
- Motivation Level: ${profile.communicationStyle.motivationLevel}
- Detail Preference: ${profile.communicationStyle.detailPreference}
- Personality Type: ${profile.communicationStyle.personalityType}
- Preferred Tone: ${profile.communicationStyle.preferredTone}

User Patterns:
- Preferred workout days: ${profile.behavioralPatterns.workoutPreferences.preferredDays.join(', ') || 'not yet determined'}
- Workout type preferences: ${Object.entries(profile.behavioralPatterns.workoutPreferences.workoutTypeAffinities).map(([type, score]) => `${type} (${score}%)`).join(', ') || 'not yet determined'}
- Difficulty preference: ${profile.behavioralPatterns.workoutPreferences.difficultyPreference}/10
- Weather sensitivity: ${profile.behavioralPatterns.contextualPatterns.weatherSensitivity}/10
- Stress response: ${profile.behavioralPatterns.contextualPatterns.stressResponse}

Current Context:
- Goals: ${context.currentGoals.join(', ')}
- Recent activity: ${context.recentActivity}
- Mood: ${context.mood || 'not specified'}
- Environment: ${context.environment || 'not specified'}`;

    if (context.weather) {
      adaptedPrompt += `
- Weather: ${context.weather.condition}, ${context.weather.temperature}°C`;
    }

    if (context.schedule) {
      adaptedPrompt += `
- Schedule: ${context.schedule.hasTime ? 'Has time' : 'Limited time'}, flexibility: ${context.schedule.flexibility}`;
    }

    adaptedPrompt += `

Based on this profile and context, respond to: "${query}"

Adaptation Guidelines:
${this.getAdaptationGuidelines(profile, context)}

Remember to be consistent with previous coaching interactions while adapting to the user's specific needs and preferences.`;

    return adaptedPrompt;
  }

  private getAdaptationGuidelines(profile: CoachingProfile, context: UserContext): string {
    const guidelines = [];

    // Communication style adaptations
    if (profile.communicationStyle.motivationLevel === 'high') {
      guidelines.push('- Use enthusiastic, highly motivational language with exclamation points and positive reinforcement');
    } else if (profile.communicationStyle.motivationLevel === 'low') {
      guidelines.push('- Use calm, measured language without excessive enthusiasm or excitement');
    }

    if (profile.communicationStyle.detailPreference === 'detailed') {
      guidelines.push('- Provide comprehensive explanations with technical details, data, and scientific reasoning');
    } else if (profile.communicationStyle.detailPreference === 'minimal') {
      guidelines.push('- Keep responses concise and to the point, avoiding unnecessary technical details');
    }

    if (profile.communicationStyle.personalityType === 'analytical') {
      guidelines.push('- Focus on data-driven insights, metrics, performance analysis, and logical reasoning');
    } else if (profile.communicationStyle.personalityType === 'encouraging') {
      guidelines.push('- Emphasize positive reinforcement, progress celebration, and supportive guidance');
    }

    // Contextual adaptations
    if (context.weather?.condition === 'rain' && profile.behavioralPatterns.contextualPatterns.weatherSensitivity > 7) {
      guidelines.push('- Proactively suggest indoor alternatives due to weather sensitivity');
    }

    if (context.mood === 'tired' || context.mood === 'stressed') {
      if (profile.behavioralPatterns.contextualPatterns.stressResponse === 'reduce_intensity') {
        guidelines.push('- Suggest lower intensity options due to current mood and stress response pattern');
      }
    }

    return guidelines.join('\n');
  }

  private getAppliedAdaptations(profile: CoachingProfile | undefined): string[] {
    if (!profile) return [];
    
    return [
      `Communication: ${profile.communicationStyle.motivationLevel} motivation, ${profile.communicationStyle.detailPreference} detail`,
      `Personality: ${profile.communicationStyle.personalityType} approach`,
      `Effectiveness: ${profile.coachingEffectivenessScore}/100`
    ];
  }

  private shouldRequestFeedback(profile: CoachingProfile | undefined): boolean {
    if (!profile) return true; // Always request feedback for new users
    
    // Request feedback based on frequency preference and recent interactions
    const frequencyMap = {
      'after_every_workout': true,
      'weekly': Math.random() < 0.3, // 30% chance
      'monthly': Math.random() < 0.1   // 10% chance
    };
    
    return frequencyMap[profile.feedbackPatterns.preferredFeedbackFrequency] || false;
  }

  private getContextFactors(context: UserContext): string[] {
    const factors = [];
    
    if (context.mood) factors.push(`mood: ${context.mood}`);
    if (context.environment) factors.push(`environment: ${context.environment}`);
    if (context.weather) factors.push(`weather: ${context.weather.condition}`);
    if (context.schedule) factors.push(`schedule: ${context.schedule.flexibility} flexibility`);
    if (context.timeConstraints) factors.push(`time constraints: ${context.timeConstraints}`);
    
    return factors;
  }

  private async recordInteraction(
    userId: number,
    response: CoachingResponse,
    context: UserContext,
    adaptedPrompt: string
  ): Promise<void> {
    try {
      await dbUtils.recordCoachingInteraction({
        userId,
        interactionId: response.interactionId,
        interactionType: 'chat',
        promptUsed: adaptedPrompt,
        responseGenerated: response.response,
        userContext: {
          currentGoals: context.currentGoals,
          recentActivity: context.recentActivity,
          ...(context.mood ? { mood: context.mood } : {}),
          ...(context.environment ? { environment: context.environment } : {}),
          ...(context.timeConstraints ? { timeConstraints: context.timeConstraints } : {}),
        },
        adaptationsApplied: response.adaptations,
        userEngagement: {
          followUpQuestions: 0, // Will be updated later
          actionTaken: false    // Will be updated later
        }
      });
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  }

  private buildRecommendationPrompt(
    profile: CoachingProfile | undefined,
    patterns: any[],
    recentFeedback: CoachingFeedback[],
    context: UserContext
  ): string {
    return `As an AI running coach, analyze the following user data and generate 2-4 personalized recommendations:

User Profile:
${profile ? `
- Communication style: ${profile.communicationStyle.personalityType}, ${profile.communicationStyle.motivationLevel} motivation
- Workout preferences: ${Object.entries(profile.behavioralPatterns.workoutPreferences.workoutTypeAffinities || {}).map(([type, score]) => `${type} (${score}%)`).join(', ')}
- Preferred days: ${profile.behavioralPatterns.workoutPreferences.preferredDays.join(', ')}
- Coaching effectiveness: ${profile.coachingEffectivenessScore}/100
` : 'No profile data available'}

Behavior Patterns:
${patterns.map(p => `- ${p.patternType}: ${p.patternData.pattern} (confidence: ${p.confidenceScore}%)`).join('\n')}

Recent Feedback:
${recentFeedback.map(f => `- ${f.interactionType}: ${f.rating}/5 stars${f.feedbackText ? ` - "${f.feedbackText}"` : ''}`).join('\n')}

Current Context:
- Goals: ${context.currentGoals.join(', ')}
- Recent activity: ${context.recentActivity}
- Mood: ${context.mood || 'unknown'}
- Environment: ${context.environment || 'unknown'}
- Weather: ${context.weather ? `${context.weather.condition}, ${context.weather.temperature}°C` : 'unknown'}

Generate recommendations that:
1. Address patterns in user behavior and feedback
2. Adapt to current context and constraints
3. Align with the user's communication and motivation preferences
4. Provide actionable, specific guidance
5. Consider coaching effectiveness and areas for improvement`;
  }

  private async analyzeFeedbackPatterns(userId: number): Promise<void> {
    try {
      const recentFeedback = await dbUtils.getCoachingFeedback(userId, 20);
      
      if (recentFeedback.length < 3) return; // Need sufficient data
      
      // Analyze rating patterns
      const averageRating = recentFeedback.reduce((sum, f) => sum + (f.rating || 3), 0) / recentFeedback.length;
      
      // Analyze feedback by interaction type
      const typeRatings: Record<string, number[]> = {};
      recentFeedback.forEach(f => {
        const bucket = typeRatings[f.interactionType] ?? (typeRatings[f.interactionType] = []);
        if (typeof f.rating === 'number') bucket.push(f.rating);
      });
      
      // Identify areas for improvement
      const improvementAreas = Object.entries(typeRatings)
        .filter(([, ratings]) => ratings.length > 0)
        .map(([type, ratings]) => ({
          type,
          avgRating: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
          count: ratings.length
        }))
        .filter(area => area.avgRating < 3.5)
        .sort((a, b) => a.avgRating - b.avgRating);

      // Record pattern if significant
      if (improvementAreas.length > 0) {
        await dbUtils.recordBehaviorPattern({
          userId,
          patternType: 'feedback_style',
          patternData: {
            pattern: 'improvement_areas_identified',
            frequency: recentFeedback.length,
            conditions: ['sufficient_feedback_data'],
            outcomes: {
              averageRating,
              improvementAreas: improvementAreas.map(area => area.type),
              lowestRatedType: improvementAreas[0]?.type
            }
          },
          confidenceScore: Math.min(90, recentFeedback.length * 4),
          lastObserved: new Date(),
          observationCount: recentFeedback.length,
        });
      }
    } catch (error) {
      console.error('Error analyzing feedback patterns:', error);
    }
  }

  private async updateCoachingEffectiveness(userId: number): Promise<void> {
    try {
      const recentFeedback = await dbUtils.getCoachingFeedback(userId, 10);
      
      if (recentFeedback.length === 0) return;
      
      // Calculate new effectiveness score
      const averageRating = recentFeedback.reduce((sum, f) => sum + (f.rating || 3), 0) / recentFeedback.length;
      const newEffectiveness = (averageRating - 1) * 25; // Convert 1-5 scale to 0-100
      
      // Update profile
      const profile = await dbUtils.getCoachingProfile(userId);
      if (profile) {
        await dbUtils.updateCoachingProfile(userId, {
          coachingEffectivenessScore: newEffectiveness
        });
      }
    } catch (error) {
      console.error('Error updating coaching effectiveness:', error);
    }
  }

  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const adaptiveCoachingEngine = AdaptiveCoachingEngine.getInstance();
