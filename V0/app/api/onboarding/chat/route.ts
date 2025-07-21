import { NextResponse } from 'next/server';
import { dbUtils } from '@/lib/db';
import { OnboardingSessionManager } from '@/lib/onboardingSessionManager';

export async function POST(req: Request) {
  try {
    const { messages, userId, userContext, currentPhase } = await req.json();

    if (!userId) {
      return new NextResponse('User ID is required', { status: 400 });
    }

    const onboardingSessionManager = new OnboardingSessionManager(userId);
    let session = await onboardingSessionManager.loadSession();

    if (!session) {
      session = await onboardingSessionManager.createNewSession();
    }

    // Add user message to history
    const userMessage = messages[messages.length - 1];
    await onboardingSessionManager.addMessageToHistory(userMessage.role, userMessage.content);

    // TODO: Integrate with actual AI coaching engine for dynamic responses
    // For now, a simple mock response based on phase
    let aiResponseContent = "";
    let nextPhase = currentPhase;

    switch (currentPhase) {
      case 'motivation':
        aiResponseContent = "That's a great start! Now, let's talk about your current running experience. Are you a complete beginner, or do you have some experience?";
        nextPhase = 'assessment';
        break;
      case 'assessment':
        aiResponseContent = "Understood. Based on that, what kind of goals are you hoping to achieve? Think about specific, measurable objectives.";
        nextPhase = 'creation';
        break;
      case 'creation':
        aiResponseContent = "Excellent! Let's refine those goals a bit. What are some potential challenges you foresee, and how can we make these goals even more realistic and time-bound?";
        nextPhase = 'refinement';
        break;
      case 'refinement':
        aiResponseContent = "Perfect! We've co-created some great goals. I'm now generating a personalized plan for you. You're all set!";
        nextPhase = 'complete';
        break;
      case 'complete':
        aiResponseContent = "You've completed the onboarding! How else can I assist you with your running journey?";
        break;
      default:
        aiResponseContent = "I'm not sure how to respond to that. Let's try to focus on your running goals.";
        break;
    }

    // Add AI response to history
    await onboardingSessionManager.addMessageToHistory('assistant', aiResponseContent);
    await onboardingSessionManager.updatePhase(nextPhase);

    const response = new NextResponse(aiResponseContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'X-Coaching-Interaction-Id': `onboarding-chat-${Date.now()}`,
        'X-Coaching-Confidence': '1.0',
        'X-Onboarding-Next-Phase': nextPhase,
      },
    });

    return response;
  } catch (error) {
    console.error('Onboarding chat API error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
