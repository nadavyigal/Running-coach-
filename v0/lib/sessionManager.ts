import { db, type OnboardingSession, type SmartGoal } from './db'
import { conversationStorage } from './conversationStorage'
import { validateOnboardingState } from './onboardingStateValidator'

export interface SessionConflict {
  type: 'multiple_active' | 'version_mismatch' | 'corrupted_data' | 'orphaned_session'
  sessionId: number
  conversationId: string
  description: string
  severity: 'low' | 'medium' | 'high'
  resolutionOptions: ConflictResolution[]
}

export interface ConflictResolution {
  action: 'keep_newest' | 'keep_oldest' | 'merge' | 'delete' | 'manual_review'
  description: string
  riskLevel: 'low' | 'medium' | 'high'
}

export interface SessionResumeData {
  session: OnboardingSession
  conversationId: string
  canResume: boolean
  resumeFrom: 'beginning' | 'last_message' | 'phase_start'
  context: {
    lastPhase: string
    progress: number
    discoveredGoals: SmartGoal[]
    messageCount: number
    lastActivity: Date
  }
  conflicts: SessionConflict[]
}

export interface SessionCreationOptions {
  userId: number
  conversationId?: string
  initialPhase?: OnboardingSession['goalDiscoveryPhase']
  coachingStyle?: OnboardingSession['coachingStyle']
  forceNew?: boolean
}

/**
 * Manages onboarding session state, conflicts, and persistence
 */
export class SessionManager {
  private activeSessionCache: Map<number, OnboardingSession> = new Map()
  private sessionLocks: Set<string> = new Set()

  /**
   * Create a new onboarding session with conflict detection
   */
  async createSession(options: SessionCreationOptions): Promise<{
    session: OnboardingSession
    conflicts: SessionConflict[]
    wasResumed: boolean
  }> {
    const { userId, conversationId, initialPhase = 'motivation', coachingStyle = 'supportive', forceNew = false } = options

    try {
      // Generate conversation ID if not provided
      const finalConversationId = conversationId || this.generateConversationId(userId)

      // Check for existing sessions and conflicts
      const conflicts = await this.detectSessionConflicts(userId, finalConversationId)
      
      // If we have conflicts and not forcing new, try to resolve them
      if (conflicts.length > 0 && !forceNew) {
        const resumeData = await this.prepareSessionResume(userId, finalConversationId)
        if (resumeData.canResume) {
          return {
            session: resumeData.session,
            conflicts,
            wasResumed: true
          }
        }
      }

      // Create new session
      const newSession: OnboardingSession = {
        userId,
        conversationId: finalConversationId,
        goalDiscoveryPhase: initialPhase,
        discoveredGoals: [],
        coachingStyle,
        sessionProgress: 0,
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const sessionId = await db.onboardingSessions.add(newSession)
      const session = { ...newSession, id: sessionId }

      // Cache the session
      this.activeSessionCache.set(userId, session)

      return {
        session,
        conflicts,
        wasResumed: false
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      throw new Error(`Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Resume an existing session with validation
   */
  async resumeSession(userId: number, conversationId?: string): Promise<SessionResumeData | null> {
    try {
      // Find the most recent session for the user
      let session: OnboardingSession | null = null

      if (conversationId) {
        session = await db.onboardingSessions
          .where('[userId+conversationId]')
          .equals([userId, conversationId])
          .first() || null
      } else {
        session = await db.onboardingSessions
          .where('userId')
          .equals(userId)
          .reverse()
          .first() || null
      }

      if (!session) {
        return null
      }

      // Detect conflicts
      const conflicts = await this.detectSessionConflicts(userId, session.conversationId)

      // Get conversation context
      const conversationData = await conversationStorage.loadConversation(session.conversationId, {
        limit: 10,
        validateIntegrity: true
      })

      // Validate session state - create a basic validation
      const validation = {
        isValid: session.id != null && session.userId > 0 && session.goalDiscoveryPhase != null,
        errors: [] as string[]
      }

      // Determine resume capability
      const canResume = validation.isValid && !session.isCompleted && conflicts.length === 0
      
      let resumeFrom: SessionResumeData['resumeFrom'] = 'beginning'
      if (canResume) {
        if (conversationData.totalMessages > 0) {
          resumeFrom = session.sessionProgress > 80 ? 'phase_start' : 'last_message'
        }
      }

      const resumeData: SessionResumeData = {
        session,
        conversationId: session.conversationId,
        canResume,
        resumeFrom,
        context: {
          lastPhase: session.goalDiscoveryPhase,
          progress: session.sessionProgress,
          discoveredGoals: session.discoveredGoals,
          messageCount: conversationData.totalMessages,
          lastActivity: conversationData.lastUpdated
        },
        conflicts
      }

      // Cache if resumable
      if (canResume) {
        this.activeSessionCache.set(userId, session)
      }

      return resumeData
    } catch (error) {
      console.error('Failed to resume session:', error)
      throw new Error(`Session resume failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update session state with progress tracking
   */
  async updateSession(
    sessionId: number,
    updates: Partial<Pick<OnboardingSession, 'goalDiscoveryPhase' | 'discoveredGoals' | 'sessionProgress' | 'isCompleted'>>
  ): Promise<OnboardingSession> {
    const lockKey = `session_${sessionId}`
    
    if (this.sessionLocks.has(lockKey)) {
      throw new Error('Session is currently being updated by another operation')
    }

    try {
      this.sessionLocks.add(lockKey)

      // Get current session
      const currentSession = await db.onboardingSessions.get(sessionId)
      if (!currentSession) {
        throw new Error(`Session ${sessionId} not found`)
      }

      // Validate phase transition if phase is being updated
      if (updates.goalDiscoveryPhase && updates.goalDiscoveryPhase !== currentSession.goalDiscoveryPhase) {
        const isValidTransition = this.validatePhaseTransition(
          currentSession.goalDiscoveryPhase,
          updates.goalDiscoveryPhase
        )
        if (!isValidTransition) {
          throw new Error(`Invalid phase transition from ${currentSession.goalDiscoveryPhase} to ${updates.goalDiscoveryPhase}`)
        }
      }

      // Calculate progress if not explicitly provided
      if (!updates.sessionProgress && updates.goalDiscoveryPhase) {
        updates.sessionProgress = this.calculateSessionProgress(updates.goalDiscoveryPhase, updates.discoveredGoals?.length || 0)
      }

      // Perform update
      const updatedData = {
        ...updates,
        updatedAt: new Date()
      }

      await db.onboardingSessions.update(sessionId, updatedData)

      // Get updated session
      const updatedSession = await db.onboardingSessions.get(sessionId)
      if (!updatedSession) {
        throw new Error('Failed to retrieve updated session')
      }

      // Update cache
      this.activeSessionCache.set(updatedSession.userId, updatedSession)

      return updatedSession
    } finally {
      this.sessionLocks.delete(lockKey)
    }
  }

  /**
   * Complete a session and perform cleanup
   */
  async completeSession(sessionId: number, finalGoals: SmartGoal[]): Promise<OnboardingSession> {
    try {
      const session = await this.updateSession(sessionId, {
        goalDiscoveryPhase: 'complete',
        discoveredGoals: finalGoals,
        sessionProgress: 100,
        isCompleted: true
      })

      // Remove from cache
      this.activeSessionCache.delete(session.userId)

      // Trigger conversation cleanup if needed
      await conversationStorage.performMaintenance({
        enableAutoCleanup: true
      })

      return session
    } catch (error) {
      console.error('Failed to complete session:', error)
      throw new Error(`Session completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Detect and categorize session conflicts
   */
  async detectSessionConflicts(userId: number, conversationId: string): Promise<SessionConflict[]> {
    const conflicts: SessionConflict[] = []

    try {
      // Check for multiple active sessions
      const activeSessions = await db.onboardingSessions
        .where('userId')
        .equals(userId)
        .and(session => !session.isCompleted)
        .toArray()

      if (activeSessions.length > 1) {
        for (const session of activeSessions) {
          conflicts.push({
            type: 'multiple_active',
            sessionId: session.id!,
            conversationId: session.conversationId,
            description: `Multiple active sessions found for user ${userId}`,
            severity: 'high',
            resolutionOptions: [
              {
                action: 'keep_newest',
                description: 'Keep the most recently created session',
                riskLevel: 'low'
              },
              {
                action: 'merge',
                description: 'Merge conversation data from all sessions',
                riskLevel: 'medium'
              }
            ]
          })
        }
      }

      // Check for orphaned sessions (session without messages)
      for (const session of activeSessions) {
        const messageCount = await db.conversationMessages
          .where('conversationId')
          .equals(session.conversationId)
          .count()

        if (messageCount === 0 && session.sessionProgress > 0) {
          conflicts.push({
            type: 'orphaned_session',
            sessionId: session.id!,
            conversationId: session.conversationId,
            description: 'Session has progress but no conversation messages',
            severity: 'medium',
            resolutionOptions: [
              {
                action: 'delete',
                description: 'Delete the orphaned session',
                riskLevel: 'low'
              },
              {
                action: 'manual_review',
                description: 'Manually review the session',
                riskLevel: 'low'
              }
            ]
          })
        }
      }

      // Check for data corruption
      for (const session of activeSessions) {
        const validation = {
          isValid: session.id != null && session.userId > 0 && session.goalDiscoveryPhase != null,
          errors: [] as string[]
        }

        if (!validation.isValid) {
          conflicts.push({
            type: 'corrupted_data',
            sessionId: session.id!,
            conversationId: session.conversationId,
            description: `Session data validation failed: ${validation.errors.join(', ')}`,
            severity: 'high',
            resolutionOptions: [
              {
                action: 'delete',
                description: 'Delete the corrupted session and start fresh',
                riskLevel: 'high'
              },
              {
                action: 'manual_review',
                description: 'Manually review and fix the data',
                riskLevel: 'medium'
              }
            ]
          })
        }
      }

      return conflicts
    } catch (error) {
      console.error('Failed to detect session conflicts:', error)
      return []
    }
  }

  /**
   * Resolve session conflicts automatically or with guidance
   */
  async resolveConflicts(conflicts: SessionConflict[], preferredActions?: Record<string, ConflictResolution['action']>): Promise<{
    resolved: number
    failed: number
    errors: string[]
  }> {
    const results = { resolved: 0, failed: 0, errors: [] }

    for (const conflict of conflicts) {
      try {
        const action = preferredActions?.[conflict.conversationId] || conflict.resolutionOptions[0]?.action

        if (!action) {
          results.errors.push(`No resolution action available for session ${conflict.sessionId}`)
          results.failed++
          continue
        }

        switch (action) {
          case 'keep_newest':
            await this.resolveMultipleActiveSessions(conflict.sessionId, 'newest')
            results.resolved++
            break

          case 'keep_oldest':
            await this.resolveMultipleActiveSessions(conflict.sessionId, 'oldest')
            results.resolved++
            break

          case 'delete':
            await this.deleteSession(conflict.sessionId)
            results.resolved++
            break

          case 'merge':
            // Merge is complex and would need additional implementation
            results.errors.push(`Merge resolution not yet implemented for session ${conflict.sessionId}`)
            results.failed++
            break

          case 'manual_review':
            results.errors.push(`Manual review required for session ${conflict.sessionId}`)
            results.failed++
            break

          default:
            results.errors.push(`Unknown resolution action: ${action}`)
            results.failed++
        }
      } catch (error) {
        results.errors.push(`Failed to resolve conflict for session ${conflict.sessionId}: ${error}`)
        results.failed++
      }
    }

    return results
  }

  /**
   * Get active session for a user
   */
  async getActiveSession(userId: number): Promise<OnboardingSession | null> {
    // Check cache first
    if (this.activeSessionCache.has(userId)) {
      return this.activeSessionCache.get(userId)!
    }

    // Query database
    const sessions = await db.onboardingSessions
      .where('userId')
      .equals(userId)
      .and(session => !session.isCompleted)
      .toArray()
    
    // Sort in memory and get the most recent
    const session = sessions.length > 0 
      ? sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
      : null

    if (session) {
      this.activeSessionCache.set(userId, session)
    }

    return session || null
  }

  /**
   * Delete a session and its associated data
   */
  async deleteSession(sessionId: number): Promise<void> {
    try {
      const session = await db.onboardingSessions.get(sessionId)
      if (!session) {
        return
      }

      // Delete conversation messages
      await conversationStorage.deleteConversation(session.conversationId)

      // Delete session
      await db.onboardingSessions.delete(sessionId)

      // Remove from cache
      this.activeSessionCache.delete(session.userId)

      console.log(`Deleted session ${sessionId} and associated conversation ${session.conversationId}`)
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(userId: number): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `conv_${userId}_${timestamp}_${random}`
  }

  /**
   * Validate phase transition logic
   */
  private validatePhaseTransition(
    fromPhase: OnboardingSession['goalDiscoveryPhase'],
    toPhase: OnboardingSession['goalDiscoveryPhase']
  ): boolean {
    const phaseOrder: OnboardingSession['goalDiscoveryPhase'][] = [
      'motivation', 'assessment', 'creation', 'refinement', 'complete'
    ]

    const fromIndex = phaseOrder.indexOf(fromPhase)
    const toIndex = phaseOrder.indexOf(toPhase)

    // Allow moving forward, backward (for corrections), or staying in same phase
    return fromIndex !== -1 && toIndex !== -1
  }

  /**
   * Calculate session progress based on phase and goals
   */
  private calculateSessionProgress(phase: OnboardingSession['goalDiscoveryPhase'], goalCount: number): number {
    const phaseProgress = {
      motivation: 20,
      assessment: 40,
      creation: 60,
      refinement: 80,
      complete: 100
    }

    let progress = phaseProgress[phase] || 0

    // Add bonus for discovered goals
    if (goalCount > 0) {
      progress = Math.min(progress + (goalCount * 5), 100)
    }

    return progress
  }

  /**
   * Prepare session resume data with validation
   */
  private async prepareSessionResume(userId: number, conversationId: string): Promise<SessionResumeData> {
    const session = await db.onboardingSessions
      .where('[userId+conversationId]')
      .equals([userId, conversationId])
      .first()

    if (!session) {
      throw new Error('Session not found for resume preparation')
    }

    return this.resumeSession(userId, conversationId) as Promise<SessionResumeData>
  }

  /**
   * Resolve multiple active sessions conflict
   */
  private async resolveMultipleActiveSessions(sessionId: number, strategy: 'newest' | 'oldest'): Promise<void> {
    const session = await db.onboardingSessions.get(sessionId)
    if (!session) return

    const allActiveSessions = await db.onboardingSessions
      .where('userId')
      .equals(session.userId)
      .and(s => !s.isCompleted)
      .toArray()

    if (allActiveSessions.length <= 1) return

    // Sort by creation date
    allActiveSessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    if (allActiveSessions.length === 0) {
      return // No sessions to resolve
    }

    const sessionToKeep = strategy === 'newest' 
      ? allActiveSessions[allActiveSessions.length - 1]
      : allActiveSessions[0]

    // Delete all other sessions
    for (const sessionToDelete of allActiveSessions) {
      if (sessionToDelete.id !== sessionToKeep.id) {
        await this.deleteSession(sessionToDelete.id!)
      }
    }
  }

  /**
   * Clear session cache
   */
  clearCache(): void {
    this.activeSessionCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; userIds: number[] } {
    return {
      size: this.activeSessionCache.size,
      userIds: Array.from(this.activeSessionCache.keys())
    }
  }
}

// Create singleton instance
export const sessionManager = new SessionManager()

// Export utility functions for backward compatibility
export const sessionUtils = {
  createSession: sessionManager.createSession.bind(sessionManager),
  resumeSession: sessionManager.resumeSession.bind(sessionManager),
  updateSession: sessionManager.updateSession.bind(sessionManager),
  completeSession: sessionManager.completeSession.bind(sessionManager),
  getActiveSession: sessionManager.getActiveSession.bind(sessionManager),
  deleteSession: sessionManager.deleteSession.bind(sessionManager),
  detectSessionConflicts: sessionManager.detectSessionConflicts.bind(sessionManager),
  resolveConflicts: sessionManager.resolveConflicts.bind(sessionManager)
}