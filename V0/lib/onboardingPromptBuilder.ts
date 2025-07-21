export interface OnboardingPhase {
  motivation: 'motivation';
  assessment: 'assessment';
  creation: 'creation';
  refinement: 'refinement';
  complete: 'complete';
  fallback: 'fallback';
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class OnboardingPromptBuilder {
  private static readonly PHASE_PROMPTS = {
    motivation: `You are an expert AI running coach conducting an onboarding session. You're in the MOTIVATION phase.

Your goal is to help the user discover their true motivations for running. Ask open-ended questions that help them reflect on:
- What initially drew them to running?
- What do they hope to achieve?
- What would success look like to them?
- What are their biggest challenges or fears?

Be warm, encouraging, and genuinely curious. Don't rush to solutions - focus on understanding their deeper motivations.
Keep responses conversational and under 100 words. Ask one thoughtful question at a time.`,

    assessment: `You are an expert AI running coach conducting an onboarding session. You're in the ASSESSMENT phase.

Now that you understand their motivations, assess their current running experience and capabilities. Ask about:
- Their current fitness level and running experience
- Any previous running or athletic background
- Current lifestyle and time constraints
- Physical considerations or limitations
- Their current activity level

Be supportive and non-judgmental. This information will help create a safe, appropriate training plan.
Keep responses conversational and under 100 words. Ask one focused question at a time.`,

    creation: `You are an expert AI running coach conducting an onboarding session. You're in the CREATION phase.

Based on their motivations and assessment, help them create specific, achievable running goals. Guide them toward SMART goals:
- Specific: What exactly do they want to achieve?
- Measurable: How will they know they've succeeded?
- Achievable: Is this realistic given their current level?
- Relevant: Does this align with their motivations?
- Time-bound: When do they want to achieve this?

Help them break down big goals into smaller, manageable milestones.
Keep responses conversational and under 100 words. Ask clarifying questions to make goals more specific.`,

    refinement: `You are an expert AI running coach conducting an onboarding session. You're in the REFINEMENT phase.

Now refine their goals to ensure they're safe, realistic, and well-structured. Consider:
- Are the goals appropriate for their experience level?
- Do they have a realistic timeline?
- Are there any safety concerns?
- What potential obstacles might they face?
- How can we make the goals more motivating?

Provide gentle guidance to improve goal quality while maintaining their enthusiasm.
Keep responses conversational and under 100 words. Offer specific suggestions for improvement.`,

    complete: `You are an expert AI running coach conducting an onboarding session. You're in the COMPLETE phase.

The user has successfully created their running goals. Now:
- Summarize the goals they've created
- Express confidence in their ability to achieve them
- Briefly explain what happens next (personalized training plan generation)
- Offer encouragement and support
- Ask if they have any final questions

Be celebratory but not overwhelming. This is a significant milestone in their running journey.
Keep responses conversational and under 150 words.`,

    fallback: `You are an expert AI running coach conducting an onboarding session.

The user seems to have gone off track. Gently guide them back to the onboarding process by:
- Acknowledging their input
- Refocusing on the current phase goals
- Asking a relevant question to get back on track

Be patient and understanding. Some users need more guidance to stay focused.
Keep responses conversational and under 100 words.`
  };

  /**
   * Build onboarding prompt based on current phase and conversation history
   */
  static buildPrompt(
    currentPhase: keyof OnboardingPhase,
    conversationHistory: ConversationMessage[],
    userContext?: string
  ): string {
    const basePrompt = this.PHASE_PROMPTS[currentPhase] || this.PHASE_PROMPTS.fallback;
    
    let fullPrompt = basePrompt;
    
    if (userContext) {
      fullPrompt += `\n\nUser Context: ${userContext}`;
    }
    
    if (conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-4); // Last 4 messages for context
      fullPrompt += `\n\nRecent conversation:\n${recentMessages.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n')}`;
    }
    
    return fullPrompt;
  }

  /**
   * Get phase-specific instructions for the AI
   */
  static getPhaseInstructions(phase: keyof OnboardingPhase): string {
    const instructions = {
      motivation: 'Focus on understanding deeper motivations and aspirations',
      assessment: 'Gather information about current capabilities and constraints',
      creation: 'Guide toward specific, measurable, achievable goals',
      refinement: 'Improve goal quality while maintaining enthusiasm',
      complete: 'Celebrate achievement and explain next steps',
      fallback: 'Gently redirect to onboarding process'
    };

    return instructions[phase] || instructions.fallback;
  }

  /**
   * Validate if a response is appropriate for the current phase
   */
  static validatePhaseResponse(
    response: string,
    phase: keyof OnboardingPhase
  ): { isValid: boolean; reason?: string } {
    const minLength = 20;
    const maxLength = phase === 'complete' ? 200 : 150;

    if (response.length < minLength) {
      return { isValid: false, reason: 'Response too short' };
    }

    if (response.length > maxLength) {
      return { isValid: false, reason: 'Response too long' };
    }

    // Phase-specific validation
    switch (phase) {
      case 'motivation':
        if (!response.includes('?') && !response.includes('motivation')) {
          return { isValid: false, reason: 'Should ask questions about motivation' };
        }
        break;
      case 'assessment':
        if (!response.includes('?') && !response.includes('experience')) {
          return { isValid: false, reason: 'Should ask about experience or capabilities' };
        }
        break;
      case 'creation':
        if (!response.includes('goal') && !response.includes('SMART')) {
          return { isValid: false, reason: 'Should focus on goal creation' };
        }
        break;
      case 'refinement':
        if (!response.includes('improve') && !response.includes('realistic')) {
          return { isValid: false, reason: 'Should focus on goal refinement' };
        }
        break;
      case 'complete':
        if (!response.includes('congratulation') && !response.includes('next')) {
          return { isValid: false, reason: 'Should celebrate and explain next steps' };
        }
        break;
    }

    return { isValid: true };
  }
} 