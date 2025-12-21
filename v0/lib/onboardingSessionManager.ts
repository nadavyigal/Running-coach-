import { db, OnboardingSession, SmartGoal } from "./db";

export class OnboardingSessionManager {
  private userId: number;
  private session: OnboardingSession | undefined;

  constructor(userId: number) {
    this.userId = userId;
  }

  async loadSession(): Promise<OnboardingSession | undefined> {
    const user = await db.users.get(this.userId);
    this.session = user?.onboardingSession;
    return this.session;
  }

  async saveSession(session: OnboardingSession): Promise<void> {
    this.session = session;
    await db.users.update(this.userId, { onboardingSession: session });
  }

  async createNewSession(): Promise<OnboardingSession> {
    const newSession: OnboardingSession = {
      conversationId: `onboarding-${Date.now()}`,
      goalDiscoveryPhase: 'motivation',
      discoveredGoals: [],
      coachingStyle: 'analytical', // Default coaching style
      conversationHistory: [],
    };
    await this.saveSession(newSession);
    return newSession;
  }

  async updatePhase(phase: OnboardingSession['goalDiscoveryPhase']): Promise<void> {
    if (this.session) {
      this.session.goalDiscoveryPhase = phase;
      await this.saveSession(this.session);
    }
  }

  async addMessageToHistory(role: 'user' | 'assistant', content: string): Promise<void> {
    if (this.session) {
      this.session.conversationHistory.push({
        id: `${role}-${Date.now()}`,
        role,
        content,
        timestamp: new Date(),
      });
      await this.saveSession(this.session);
    }
  }

  async addDiscoveredGoal(goal: SmartGoal): Promise<void> {
    if (this.session) {
      this.session.discoveredGoals.push(goal);
      await this.saveSession(this.session);
    }
  }

  async getConversationHistory(): Promise<OnboardingSession['conversationHistory']> {
    return this.session?.conversationHistory || [];
  }

  async getDiscoveredGoals(): Promise<SmartGoal[]> {
    return this.session?.discoveredGoals || [];
  }

  async getCoachingStyle(): Promise<OnboardingSession['coachingStyle']> {
    return this.session?.coachingStyle || 'analytical';
  }

  async setCoachingStyle(style: OnboardingSession['coachingStyle']): Promise<void> {
    if (this.session) {
      this.session.coachingStyle = style;
      await this.saveSession(this.session);
    }
  }

  async getConversationLength(): Promise<number> {
    return this.session?.conversationHistory.length || 0;
  }

  async clearSession(): Promise<void> {
    if (this.userId) {
      await db.users.update(this.userId, { onboardingSession: undefined });
      this.session = undefined;
    }
  }
}
