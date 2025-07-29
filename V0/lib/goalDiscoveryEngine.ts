/**
 * AI-Guided Goal Discovery Engine
 * Implements sophisticated goal analysis, discovery, and recommendation logic
 * for helping users identify and set appropriate running goals
 */

import { dbUtils, type User } from '@/lib/db';

// Core interfaces for goal discovery
export interface DiscoveredGoal {
  id: string;
  title: string;
  description: string;
  goalType: 'time_improvement' | 'distance_achievement' | 'frequency' | 'race_completion' | 'consistency' | 'health';
  category: 'speed' | 'endurance' | 'consistency' | 'health' | 'strength';
  priority: 1 | 2 | 3;
  confidence: number; // 0-1 confidence in goal appropriateness
  reasoning: string;
  specificTarget: {
    metric: string;
    value: number;
    unit: string;
    description: string;
  };
  measurableMetrics: string[];
  achievableAssessment: {
    currentLevel: number;
    targetLevel: number;
    feasibilityScore: number;
    recommendedAdjustments?: string[];
  };
  relevantContext: string;
  timeBound: {
    startDate: Date;
    deadline: Date;
    totalDuration: number; // days
    milestoneSchedule: number[]; // percentage milestones
  };
  baselineValue: number;
  targetValue: number;
  motivationalFactors: string[];
  potentialBarriers: string[];
  suggestedActions: string[];
}

export interface UserProfile {
  experience: 'beginner' | 'intermediate' | 'advanced';
  currentFitnessLevel: number; // 1-10 scale
  availableTime: {
    daysPerWeek: number;
    minutesPerSession: number;
    preferredTimes: string[];
  };
  physicalLimitations: string[];
  pastInjuries: string[];
  motivations: string[];
  barriers: string[];
  preferences: {
    coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
    workoutTypes: string[];
    environment: 'indoor' | 'outdoor' | 'both';
  };
  age?: number;
  goals?: string[]; // High-level goals mentioned by user
}

export interface GoalDiscoveryResult {
  discoveredGoals: DiscoveredGoal[];
  primaryGoal: DiscoveredGoal;
  supportingGoals: DiscoveredGoal[];
  overallConfidence: number;
  recommendations: string[];
  nextSteps: string[];
  estimatedSuccessProbability: number;
}

export interface GoalAnalysisContext {
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userResponses?: Record<string, any>;
  behaviorPatterns?: any;
  existingGoals?: any[];
}

class GoalDiscoveryEngine {
  private readonly GOAL_TEMPLATES = {
    beginner: {
      consistency: {
        title: "Build Running Habit",
        description: "Establish a consistent running routine",
        goalType: "frequency" as const,
        category: "consistency" as const,
        baseTarget: { value: 2, unit: "runs/week" },
        duration: 56 // 8 weeks
      },
      health: {
        title: "Improve Cardiovascular Health",
        description: "Enhance overall fitness and endurance",
        goalType: "health" as const,
        category: "health" as const,
        baseTarget: { value: 30, unit: "minutes" },
        duration: 84 // 12 weeks
      },
      distance: {
        title: "Complete First 5K",
        description: "Build up to running a full 5K distance",
        goalType: "distance_achievement" as const,
        category: "endurance" as const,
        baseTarget: { value: 5000, unit: "meters" },
        duration: 70 // 10 weeks
      }
    },
    intermediate: {
      distance: {
        title: "Improve 5K Time",
        description: "Achieve a personal best in 5K distance",
        goalType: "time_improvement" as const,
        category: "speed" as const,
        baseTarget: { value: 1500, unit: "seconds" }, // 25 minutes
        duration: 84 // 12 weeks
      },
      endurance: {
        title: "Complete 10K Distance",
        description: "Train for and complete a 10K run",
        goalType: "distance_achievement" as const,
        category: "endurance" as const,
        baseTarget: { value: 10000, unit: "meters" },
        duration: 98 // 14 weeks
      },
      consistency: {
        title: "Maintain 3-4x Weekly Running",
        description: "Establish regular training routine",
        goalType: "frequency" as const,
        category: "consistency" as const,
        baseTarget: { value: 3.5, unit: "runs/week" },
        duration: 84 // 12 weeks
      }
    },
    advanced: {
      speed: {
        title: "Sub-20 5K Achievement",
        description: "Break the 20-minute barrier in 5K",
        goalType: "time_improvement" as const,
        category: "speed" as const,
        baseTarget: { value: 1200, unit: "seconds" }, // 20 minutes
        duration: 112 // 16 weeks
      },
      endurance: {
        title: "Half Marathon Preparation",
        description: "Train for and complete a half marathon",
        goalType: "race_completion" as const,
        category: "endurance" as const,
        baseTarget: { value: 21097, unit: "meters" },
        duration: 140 // 20 weeks
      },
      consistency: {
        title: "5-6x Weekly Training",
        description: "Advanced training frequency with quality sessions",
        goalType: "frequency" as const,
        category: "consistency" as const,
        baseTarget: { value: 5.5, unit: "runs/week" },
        duration: 84 // 12 weeks
      }
    }
  };

  /**
   * Main goal discovery method - analyzes user profile and context to discover appropriate goals
   */
  async discoverGoals(
    userProfile: UserProfile,
    context: GoalAnalysisContext = {}
  ): Promise<GoalDiscoveryResult> {
    try {
      console.log('🎯 Goal Discovery Engine: Starting goal discovery for profile:', userProfile);

      // Step 1: Analyze user context and extract insights
      const insights = await this.analyzeUserContext(userProfile, context);
      console.log('📊 Context insights:', insights);

      // Step 2: Generate goal candidates based on profile and insights
      const goalCandidates = await this.generateGoalCandidates(userProfile, insights);
      console.log('🎯 Generated goal candidates:', goalCandidates.length);

      // Step 3: Score and rank goals
      const rankedGoals = await this.scoreAndRankGoals(goalCandidates, userProfile, insights);
      console.log('📈 Ranked goals:', rankedGoals.length);

      // Step 4: Select primary and supporting goals
      const { primaryGoal, supportingGoals } = this.selectOptimalGoalSet(rankedGoals, userProfile);
      console.log('✅ Selected primary goal:', primaryGoal.title);

      // Step 5: Generate recommendations and next steps
      const recommendations = this.generateRecommendations(primaryGoal, supportingGoals, userProfile);
      const nextSteps = this.generateNextSteps(primaryGoal, supportingGoals, userProfile);

      // Step 6: Calculate overall confidence and success probability
      const overallConfidence = this.calculateOverallConfidence(rankedGoals);
      const successProbability = this.estimateSuccessProbability(primaryGoal, supportingGoals, userProfile);

      return {
        discoveredGoals: rankedGoals,
        primaryGoal,
        supportingGoals,
        overallConfidence,
        recommendations,
        nextSteps,
        estimatedSuccessProbability: successProbability
      };

    } catch (error) {
      console.error('❌ Goal Discovery Engine error:', error);
      // Return fallback goal set
      return this.generateFallbackGoalSet(userProfile);
    }
  }

  /**
   * Extract insights from conversation and user context
   */
  private async analyzeUserContext(
    userProfile: UserProfile,
    context: GoalAnalysisContext
  ): Promise<Record<string, any>> {
    const insights: Record<string, any> = {
      experienceLevel: userProfile.experience,
      timeConstraints: userProfile.availableTime,
      motivationStrength: this.assessMotivationStrength(userProfile.motivations),
      barrierSeverity: this.assessBarrierSeverity(userProfile.barriers),
      preferenceAlignment: {},
      conversationTopics: []
    };

    // Analyze conversation history if available
    if (context.conversationHistory) {
      insights.conversationTopics = this.extractConversationTopics(context.conversationHistory);
      insights.emotionalTone = this.analyzeEmotionalTone(context.conversationHistory);
      insights.specificMentions = this.extractSpecificMentions(context.conversationHistory);
    }

    // Assess physical readiness
    insights.physicalReadiness = this.assessPhysicalReadiness(userProfile);

    // Evaluate goal complexity capacity
    insights.complexityCapacity = this.assessComplexityCapacity(userProfile);

    return insights;
  }

  /**
   * Generate goal candidates based on user profile and insights
   */
  private async generateGoalCandidates(
    userProfile: UserProfile,
    insights: Record<string, any>
  ): Promise<DiscoveredGoal[]> {
    const candidates: DiscoveredGoal[] = [];
    const templates = this.GOAL_TEMPLATES[userProfile.experience];

    // Generate goals from templates
    for (const [category, template] of Object.entries(templates)) {
      const goal = await this.createGoalFromTemplate(template, userProfile, insights, category);
      if (goal) {
        candidates.push(goal);
      }
    }

    // Generate custom goals based on specific user mentions
    if (insights.specificMentions) {
      const customGoals = await this.generateCustomGoals(insights.specificMentions, userProfile);
      candidates.push(...customGoals);
    }

    // Generate adaptive goals based on motivations
    const motivationBasedGoals = await this.generateMotivationBasedGoals(userProfile.motivations, userProfile);
    candidates.push(...motivationBasedGoals);

    return candidates;
  }

  /**
   * Score and rank goals based on suitability for the user
   */
  private async scoreAndRankGoals(
    candidates: DiscoveredGoal[],
    userProfile: UserProfile,
    insights: Record<string, any>
  ): Promise<DiscoveredGoal[]> {
    const scoredGoals = candidates.map(goal => {
      let score = 0;

      // Base suitability score (30%)
      score += this.calculateBaseSuitability(goal, userProfile) * 0.3;

      // Motivation alignment score (25%)
      score += this.calculateMotivationAlignment(goal, userProfile.motivations) * 0.25;

      // Feasibility score (20%)
      score += this.calculateFeasibility(goal, userProfile) * 0.2;

      // Time constraint compatibility (15%)
      score += this.calculateTimeCompatibility(goal, userProfile.availableTime) * 0.15;

      // Context relevance score (10%)
      score += this.calculateContextRelevance(goal, insights) * 0.1;

      // Update goal confidence
      goal.confidence = Math.max(0, Math.min(1, score));

      return goal;
    });

    // Sort by confidence score
    return scoredGoals.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Select optimal combination of primary and supporting goals
   */
  private selectOptimalGoalSet(
    rankedGoals: DiscoveredGoal[],
    userProfile: UserProfile
  ): { primaryGoal: DiscoveredGoal; supportingGoals: DiscoveredGoal[] } {
    // Select highest confidence goal as primary
    const primaryGoal = rankedGoals[0];

    // Select supporting goals that complement the primary goal
    const supportingGoals = rankedGoals
      .slice(1)
      .filter(goal => 
        goal.category !== primaryGoal.category && // Different category
        goal.confidence > 0.6 && // High enough confidence  
        this.isComplementaryGoal(goal, primaryGoal) // Complementary to primary
      )
      .slice(0, 2); // Maximum 2 supporting goals

    return { primaryGoal, supportingGoals };
  }

  /**
   * Create a goal from a template with user-specific customization
   */
  private async createGoalFromTemplate(
    template: any,
    userProfile: UserProfile,
    insights: Record<string, any>,
    category: string
  ): Promise<DiscoveredGoal | null> {
    try {
      const now = new Date();
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + template.duration);

      // Adjust target based on user profile
      const adjustedTarget = this.adjustTargetForUser(template.baseTarget, userProfile, category);

      const goal: DiscoveredGoal = {
        id: `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: template.title,
        description: template.description,
        goalType: template.goalType,
        category: template.category,
        priority: category === 'consistency' ? 1 : 2,
        confidence: 0, // Will be calculated in scoring
        reasoning: `Recommended for ${userProfile.experience} runners based on your profile`,
        specificTarget: {
          metric: adjustedTarget.metric,
          value: adjustedTarget.value,
          unit: adjustedTarget.unit,
          description: `${template.title}: ${adjustedTarget.value} ${adjustedTarget.unit}`
        },
        measurableMetrics: [adjustedTarget.metric],
        achievableAssessment: {
          currentLevel: adjustedTarget.baseline || 0,
          targetLevel: adjustedTarget.value,
          feasibilityScore: this.calculateFeasibilityScore(adjustedTarget, userProfile),
          recommendedAdjustments: []
        },
        relevantContext: `Designed for ${userProfile.experience} runners with ${userProfile.availableTime.daysPerWeek} days/week availability`,
        timeBound: {
          startDate: now,
          deadline,
          totalDuration: template.duration,
          milestoneSchedule: [25, 50, 75, 90]
        },
        baselineValue: adjustedTarget.baseline || 0,
        targetValue: adjustedTarget.value,
        motivationalFactors: this.extractRelevantMotivations(userProfile.motivations, category),
        potentialBarriers: this.identifyRelevantBarriers(userProfile.barriers, category),
        suggestedActions: this.generateInitialActions(template, userProfile)
      };

      return goal;
    } catch (error) {
      console.error('Error creating goal from template:', error);
      return null;
    }
  }

  // Helper methods for scoring and analysis
  private calculateBaseSuitability(goal: DiscoveredGoal, userProfile: UserProfile): number {
    let score = 0.5; // base score

    // Experience level alignment
    if (userProfile.experience === 'beginner' && goal.category === 'consistency') score += 0.3;
    if (userProfile.experience === 'intermediate' && ['speed', 'endurance'].includes(goal.category)) score += 0.2;
    if (userProfile.experience === 'advanced' && goal.category === 'speed') score += 0.2;

    // Age considerations
    if (userProfile.age) {
      if (userProfile.age > 50 && goal.category === 'health') score += 0.1;
      if (userProfile.age < 30 && goal.category === 'speed') score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateMotivationAlignment(goal: DiscoveredGoal, motivations: string[]): number {
    if (!motivations.length) return 0.5;

    let alignmentScore = 0;
    const motivationLower = motivations.map(m => m.toLowerCase());

    // Check alignment with goal category
    if (goal.category === 'health' && motivationLower.some(m => m.includes('health') || m.includes('fitness'))) {
      alignmentScore += 0.4;
    }
    if (goal.category === 'speed' && motivationLower.some(m => m.includes('fast') || m.includes('time') || m.includes('race'))) {
      alignmentScore += 0.4;
    }
    if (goal.category === 'endurance' && motivationLower.some(m => m.includes('distance') || m.includes('marathon') || m.includes('endurance'))) {
      alignmentScore += 0.4;
    }
    if (goal.category === 'consistency' && motivationLower.some(m => m.includes('habit') || m.includes('regular') || m.includes('routine'))) {
      alignmentScore += 0.4;
    }

    return Math.max(0, Math.min(1, alignmentScore + 0.2)); // base + alignment
  }

  private calculateFeasibility(goal: DiscoveredGoal, userProfile: UserProfile): number {
    let score = 0.7; // base feasibility

    // Time availability check
    const requiredTimePerWeek = this.estimateRequiredTime(goal);
    const availableTimePerWeek = userProfile.availableTime.daysPerWeek * userProfile.availableTime.minutesPerSession;
    
    if (requiredTimePerWeek <= availableTimePerWeek) {
      score += 0.2;
    } else if (requiredTimePerWeek <= availableTimePerWeek * 1.2) {
      score += 0.1;
    } else {
      score -= 0.2;
    }

    // Physical limitations check
    if (userProfile.physicalLimitations.length > 0) {
      score -= 0.1 * userProfile.physicalLimitations.length;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateTimeCompatibility(goal: DiscoveredGoal, availableTime: UserProfile['availableTime']): number {
    const requiredSessions = this.estimateRequiredSessions(goal);
    const compatibilityRatio = availableTime.daysPerWeek / requiredSessions;
    
    if (compatibilityRatio >= 1) return 1;
    if (compatibilityRatio >= 0.8) return 0.8;
    if (compatibilityRatio >= 0.6) return 0.6;
    return 0.4;
  }

  private calculateContextRelevance(goal: DiscoveredGoal, insights: Record<string, any>): number {
    let score = 0.5;

    // Check if goal aligns with conversation topics
    if (insights.conversationTopics) {
      const relevantTopics = this.findRelevantTopics(goal, insights.conversationTopics);
      if (relevantTopics.length > 0) {
        score += 0.3 * Math.min(1, relevantTopics.length / 3);
      }
    }

    // Check emotional tone alignment
    if (insights.emotionalTone === 'motivated' && goal.category === 'speed') score += 0.2;
    if (insights.emotionalTone === 'cautious' && goal.category === 'health') score += 0.2;

    return Math.max(0, Math.min(1, score));
  }

  // Additional helper methods
  private assessMotivationStrength(motivations: string[]): number {
    return Math.min(1, motivations.length / 5);
  }

  private assessBarrierSeverity(barriers: string[]): number {
    return Math.min(1, barriers.length / 3);
  }

  private extractConversationTopics(history: Array<{ role: string; content: string }>): string[] {
    const topics: string[] = [];
    const keywords = ['race', 'marathon', '5k', '10k', 'speed', 'time', 'distance', 'health', 'fitness', 'habit', 'consistent'];
    
    history.forEach(message => {
      if (message.role === 'user') {
        const content = message.content.toLowerCase();
        keywords.forEach(keyword => {
          if (content.includes(keyword) && !topics.includes(keyword)) {
            topics.push(keyword);
          }
        });
      }
    });
    
    return topics;
  }

  private analyzeEmotionalTone(history: Array<{ role: string; content: string }>): string {
    const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
    const allText = userMessages.join(' ');

    if (allText.includes('excited') || allText.includes('motivated') || allText.includes('ready')) {
      return 'motivated';
    }
    if (allText.includes('careful') || allText.includes('slow') || allText.includes('gentle')) {
      return 'cautious';
    }
    if (allText.includes('challenge') || allText.includes('push') || allText.includes('aggressive')) {
      return 'ambitious';
    }
    return 'neutral';
  }

  private extractSpecificMentions(history: Array<{ role: string; content: string }>): Record<string, any> {
    const mentions: Record<string, any> = {};
    const userText = history.filter(m => m.role === 'user').map(m => m.content).join(' ').toLowerCase();

    // Extract race mentions
    const raceMatches = userText.match(/(5k|10k|half marathon|marathon|race)/g);
    if (raceMatches) mentions.races = [...new Set(raceMatches)];

    // Extract time mentions
    const timeMatches = userText.match(/(\d+)\s*(minute|hour|day|week)/g);
    if (timeMatches) mentions.timeReferences = timeMatches;

    // Extract distance mentions
    const distanceMatches = userText.match(/(\d+)\s*(mile|km|kilometer|meter)/g);
    if (distanceMatches) mentions.distances = distanceMatches;

    return mentions;
  }

  private assessPhysicalReadiness(userProfile: UserProfile): number {
    let readiness = 0.8; // base readiness

    if (userProfile.pastInjuries.length > 0) readiness -= 0.1 * userProfile.pastInjuries.length;
    if (userProfile.physicalLimitations.length > 0) readiness -= 0.1 * userProfile.physicalLimitations.length;
    if (userProfile.age && userProfile.age > 50) readiness -= 0.1;

    return Math.max(0.2, Math.min(1, readiness));
  }

  private assessComplexityCapacity(userProfile: UserProfile): number {
    let capacity = 0.5; // base capacity

    if (userProfile.experience === 'advanced') capacity += 0.3;
    if (userProfile.experience === 'intermediate') capacity += 0.2;
    if (userProfile.availableTime.daysPerWeek >= 4) capacity += 0.2;

    return Math.max(0, Math.min(1, capacity));
  }

  private generateCustomGoals(mentions: Record<string, any>, userProfile: UserProfile): DiscoveredGoal[] {
    const goals: DiscoveredGoal[] = [];
    
    // Generate race-specific goals
    if (mentions.races) {
      mentions.races.forEach((race: string) => {
        const goal = this.createRaceGoal(race, userProfile);
        if (goal) goals.push(goal);
      });
    }

    return goals;
  }

  private generateMotivationBasedGoals(motivations: string[], userProfile: UserProfile): DiscoveredGoal[] {
    const goals: DiscoveredGoal[] = [];
    
    motivations.forEach(motivation => {
      const goal = this.createMotivationGoal(motivation, userProfile);
      if (goal) goals.push(goal);
    });

    return goals;
  }

  private createRaceGoal(race: string, userProfile: UserProfile): DiscoveredGoal | null {
    // Implementation for race-specific goal creation
    return null; // Placeholder
  }

  private createMotivationGoal(motivation: string, userProfile: UserProfile): DiscoveredGoal | null {
    // Implementation for motivation-based goal creation
    return null; // Placeholder
  }

  private adjustTargetForUser(baseTarget: any, userProfile: UserProfile, category: string): any {
    let adjustedTarget = { ...baseTarget };
    
    // Adjust based on experience
    if (userProfile.experience === 'beginner') {
      adjustedTarget.value *= 0.8; // 20% easier
    } else if (userProfile.experience === 'advanced') {
      adjustedTarget.value *= 1.2; // 20% more challenging
    }

    // Adjust based on available time
    if (userProfile.availableTime.daysPerWeek < 3) {
      adjustedTarget.value *= 0.9; // Slightly easier for limited time
    }

    // Set appropriate metric and baseline
    switch (category) {
      case 'consistency':
        adjustedTarget.metric = 'weekly_runs';
        adjustedTarget.baseline = Math.max(1, userProfile.availableTime.daysPerWeek - 1);
        break;
      case 'distance':
        adjustedTarget.metric = 'max_distance';
        adjustedTarget.baseline = userProfile.experience === 'beginner' ? 1000 : 3000;
        break;
      case 'health':
        adjustedTarget.metric = 'weekly_duration';
        adjustedTarget.baseline = userProfile.availableTime.minutesPerSession;
        break;
    }

    return adjustedTarget;
  }

  private calculateFeasibilityScore(target: any, userProfile: UserProfile): number {
    // Calculate how feasible the target is for this user
    let score = 70; // base feasibility

    if (userProfile.experience === 'beginner') score += 10;
    if (userProfile.availableTime.daysPerWeek >= target.value) score += 15;
    if (userProfile.physicalLimitations.length === 0) score += 5;

    return Math.max(30, Math.min(100, score));
  }

  private extractRelevantMotivations(motivations: string[], category: string): string[] {
    return motivations.filter(m => {
      const lower = m.toLowerCase();
      switch (category) {
        case 'health': return lower.includes('health') || lower.includes('fitness');
        case 'speed': return lower.includes('fast') || lower.includes('race') || lower.includes('time');
        case 'endurance': return lower.includes('distance') || lower.includes('marathon') || lower.includes('endurance');
        case 'consistency': return lower.includes('habit') || lower.includes('routine') || lower.includes('regular');
        default: return true;
      }
    });
  }

  private identifyRelevantBarriers(barriers: string[], category: string): string[] {
    // Filter barriers that are most relevant to this goal category
    return barriers;
  }

  private generateInitialActions(template: any, userProfile: UserProfile): string[] {
    const actions = [];
    
    if (userProfile.experience === 'beginner') {
      actions.push('Start with a walking assessment to gauge current fitness');
      actions.push('Plan 2-3 shorter sessions in your first week');
    }
    
    actions.push('Schedule your running times in your calendar');
    actions.push('Choose your running route and backup options');
    
    return actions;
  }

  private isComplementaryGoal(goal1: DiscoveredGoal, goal2: DiscoveredGoal): boolean {
    // Check if goals complement each other well
    const complementaryPairs = [
      ['consistency', 'health'],
      ['speed', 'consistency'],
      ['endurance', 'consistency'],
      ['health', 'endurance']
    ];

    return complementaryPairs.some(pair => 
      (pair.includes(goal1.category) && pair.includes(goal2.category))
    );
  }

  private estimateRequiredTime(goal: DiscoveredGoal): number {
    // Estimate weekly time requirement in minutes
    switch (goal.category) {
      case 'consistency': return goal.specificTarget.value * 30; // runs per week * 30 min
      case 'speed': return 150; // 3 sessions * 50 min
      case 'endurance': return 180; // 3 sessions * 60 min
      case 'health': return 120; // 4 sessions * 30 min
      default: return 120;
    }
  }

  private estimateRequiredSessions(goal: DiscoveredGoal): number {
    switch (goal.category) {
      case 'consistency': return goal.specificTarget.value;
      case 'speed': return 3;
      case 'endurance': return 3;
      case 'health': return 3;
      default: return 3;
    }
  }

  private findRelevantTopics(goal: DiscoveredGoal, topics: string[]): string[] {
    return topics.filter(topic => {
      switch (goal.category) {
        case 'speed': return ['speed', 'time', 'race', '5k'].includes(topic);
        case 'endurance': return ['distance', 'marathon', '10k', 'endurance'].includes(topic);
        case 'health': return ['health', 'fitness'].includes(topic);
        case 'consistency': return ['habit', 'consistent'].includes(topic);
        default: return false;
      }
    });
  }

  private generateRecommendations(
    primary: DiscoveredGoal, 
    supporting: DiscoveredGoal[], 
    userProfile: UserProfile
  ): string[] {
    const recommendations = [];

    recommendations.push(`Focus primarily on "${primary.title}" as your main goal`);
    
    if (supporting.length > 0) {
      recommendations.push(`Support this with ${supporting.map(g => `"${g.title}"`).join(' and ')}`);
    }

    if (userProfile.experience === 'beginner') {
      recommendations.push('Start slowly and prioritize consistency over intensity');
    }

    if (userProfile.barriers.length > 0) {
      recommendations.push('Address your identified barriers proactively');
    }

    return recommendations;
  }

  private generateNextSteps(
    primary: DiscoveredGoal, 
    supporting: DiscoveredGoal[], 
    userProfile: UserProfile
  ): string[] {
    const steps = [];

    steps.push('Complete your onboarding to generate your personalized training plan');
    steps.push(`Begin with ${primary.suggestedActions[0] || 'your first planned session'}`);
    
    if (userProfile.availableTime) {
      steps.push(`Schedule your ${userProfile.availableTime.daysPerWeek} weekly sessions`);
    }

    steps.push('Track your first week of progress');

    return steps;
  }

  private calculateOverallConfidence(goals: DiscoveredGoal[]): number {
    if (goals.length === 0) return 0;
    return goals.reduce((sum, goal) => sum + goal.confidence, 0) / goals.length;
  }

  private estimateSuccessProbability(
    primary: DiscoveredGoal, 
    supporting: DiscoveredGoal[], 
    userProfile: UserProfile
  ): number {
    let probability = primary.confidence * 0.7; // Base on primary goal confidence

    // Adjust for user factors
    if (userProfile.motivations.length > 2) probability += 0.1;
    if (userProfile.barriers.length < 2) probability += 0.1;
    if (userProfile.availableTime.daysPerWeek >= 3) probability += 0.1;

    return Math.max(0.3, Math.min(0.95, probability));
  }

  private generateFallbackGoalSet(userProfile: UserProfile): GoalDiscoveryResult {
    // Generate a basic goal set when main discovery fails
    const now = new Date();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 56); // 8 weeks

    const fallbackGoal: DiscoveredGoal = {
      id: `fallback_${Date.now()}`,
      title: "Build Running Habit",
      description: "Start with a basic running routine to build consistency",
      goalType: "frequency",
      category: "consistency",
      priority: 1,
      confidence: 0.7,
      reasoning: "Fallback goal for building basic running habit",
      specificTarget: {
        metric: "weekly_runs",
        value: 2,
        unit: "runs/week",
        description: "Run 2 times per week"
      },
      measurableMetrics: ["weekly_runs"],
      achievableAssessment: {
        currentLevel: 0,
        targetLevel: 2,
        feasibilityScore: 80
      },
      relevantContext: "Basic starting goal for new runners",
      timeBound: {
        startDate: now,
        deadline,
        totalDuration: 56,
        milestoneSchedule: [25, 50, 75]
      },
      baselineValue: 0,
      targetValue: 2,
      motivationalFactors: ["building habit", "improving health"],
      potentialBarriers: ["time constraints", "motivation"],
      suggestedActions: ["Schedule 2 run times per week", "Start with short 20-minute sessions"]
    };

    return {
      discoveredGoals: [fallbackGoal],
      primaryGoal: fallbackGoal,
      supportingGoals: [],
      overallConfidence: 0.7,
      recommendations: ["Start with consistency", "Build the habit first"],
      nextSteps: ["Schedule your first run", "Complete onboarding"],
      estimatedSuccessProbability: 0.8
    };
  }
}

// Export singleton instance
export const goalDiscoveryEngine = new GoalDiscoveryEngine();