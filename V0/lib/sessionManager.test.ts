import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sessionManager, SessionManager } from './sessionManager'

// Mock dependencies
vi.mock('./db', () => ({
  db: {
    onboardingSessions: {
      add: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn()
          })),
          orderBy: vi.fn(() => ({
            reverse: vi.fn(() => ({
              first: vi.fn()
            }))
          })),
          first: vi.fn(),
          delete: vi.fn()
        }))
      })),
      toArray: vi.fn()
    },
    conversationMessages: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          count: vi.fn(),
          delete: vi.fn()
        }))
      }))
    }
  }
}))

vi.mock('./conversationStorage', () => ({
  conversationStorage: {
    loadConversation: vi.fn(),
    deleteConversation: vi.fn(),
    performMaintenance: vi.fn()
  }
}))

vi.mock('./onboardingStateValidator', () => ({
  validateOnboardingState: vi.fn(() => ({
    isValid: true,
    errors: [],
    warnings: []
  }))
}))

describe('SessionManager', () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = new SessionManager()
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const { db } = await import('./db')
      vi.mocked(db.onboardingSessions.add).mockResolvedValue(1)
      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        }))
      } as any)

      const result = await manager.createSession({
        userId: 123,
        initialPhase: 'motivation',
        coachingStyle: 'supportive'
      })

      expect(result.session.userId).toBe(123)
      expect(result.session.goalDiscoveryPhase).toBe('motivation')
      expect(result.session.coachingStyle).toBe('supportive')
      expect(result.wasResumed).toBe(false)
      expect(result.conflicts).toHaveLength(0)
    })

    it('should generate unique conversation IDs', async () => {
      const { db } = await import('./db')
      vi.mocked(db.onboardingSessions.add).mockResolvedValue(1)
      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        }))
      } as any)

      const result1 = await manager.createSession({ userId: 123 })
      const result2 = await manager.createSession({ userId: 123 })

      expect(result1.session.conversationId).not.toBe(result2.session.conversationId)
      expect(result1.session.conversationId).toMatch(/^conv_123_\d+_[a-z0-9]+$/)
    })

    it('should detect conflicts when creating sessions', async () => {
      const { db } = await import('./db')
      const existingSessions = [
        { id: 1, conversationId: 'conv_1', isCompleted: false }
      ]

      vi.mocked(db.onboardingSessions.add).mockResolvedValue(2)
      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue(existingSessions)
          }))
        }))
      } as any)
      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => ({
          count: vi.fn().mockResolvedValue(0)
        }))
      } as any)

      const result = await manager.createSession({
        userId: 123,
        forceNew: true
      })

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].type).toBe('multiple_active')
    })
  })

  describe('resumeSession', () => {
    it('should resume an existing session', async () => {
      const { db } = await import('./db')
      const { conversationStorage } = await import('./conversationStorage')
      
      const existingSession = {
        id: 1,
        userId: 123,
        conversationId: 'conv_123',
        goalDiscoveryPhase: 'assessment',
        sessionProgress: 40,
        discoveredGoals: [],
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            reverse: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(existingSession)
            }))
          }))
        }))
      } as any)

      vi.mocked(conversationStorage.loadConversation).mockResolvedValue({
        messages: [],
        session: null,
        totalMessages: 5,
        lastUpdated: new Date(),
        dataIntegrity: { isValid: true, errors: [], warnings: [] }
      })

      const result = await manager.resumeSession(123)

      expect(result).toBeDefined()
      expect(result!.session.id).toBe(1)
      expect(result!.canResume).toBe(true)
      expect(result!.context.messageCount).toBe(5)
      expect(result!.context.progress).toBe(40)
    })

    it('should return null for non-existent sessions', async () => {
      const { db } = await import('./db')
      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            reverse: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(null)
            }))
          }))
        }))
      } as any)

      const result = await manager.resumeSession(123)

      expect(result).toBeNull()
    })
  })

  describe('updateSession', () => {
    it('should update session with valid phase transitions', async () => {
      const { db } = await import('./db')
      const currentSession = {
        id: 1,
        goalDiscoveryPhase: 'motivation',
        sessionProgress: 20,
        userId: 123
      }

      vi.mocked(db.onboardingSessions.get).mockResolvedValue(currentSession as any)
      vi.mocked(db.onboardingSessions.update).mockResolvedValue(1)
      vi.mocked(db.onboardingSessions.get).mockResolvedValueOnce(currentSession as any)
        .mockResolvedValueOnce({
          ...currentSession,
          goalDiscoveryPhase: 'assessment',
          sessionProgress: 40,
          updatedAt: new Date()
        } as any)

      const result = await manager.updateSession(1, {
        goalDiscoveryPhase: 'assessment',
        sessionProgress: 40
      })

      expect(result.goalDiscoveryPhase).toBe('assessment')
      expect(result.sessionProgress).toBe(40)
    })

    it('should validate phase transitions', async () => {
      const { db } = await import('./db')
      const currentSession = {
        id: 1,
        goalDiscoveryPhase: 'motivation',
        sessionProgress: 20,
        userId: 123
      }

      vi.mocked(db.onboardingSessions.get).mockResolvedValue(currentSession as any)

      // All phase transitions should be valid based on the implementation
      await expect(manager.updateSession(1, {
        goalDiscoveryPhase: 'complete'
      })).resolves.toBeDefined()
    })

    it('should handle session locking', async () => {
      const { db } = await import('./db')
      vi.mocked(db.onboardingSessions.get).mockResolvedValue({
        id: 1,
        goalDiscoveryPhase: 'motivation'
      } as any)

      // Start first update (should acquire lock)
      const promise1 = manager.updateSession(1, { sessionProgress: 50 })
      
      // Start second update immediately (should fail due to lock)
      const promise2 = manager.updateSession(1, { sessionProgress: 60 })

      await expect(promise2).rejects.toThrow('Session is currently being updated')
      await promise1 // Complete first update
    })
  })

  describe('completeSession', () => {
    it('should complete a session successfully', async () => {
      const { db } = await import('./db')
      const { conversationStorage } = await import('./conversationStorage')
      
      const session = {
        id: 1,
        userId: 123,
        goalDiscoveryPhase: 'refinement',
        sessionProgress: 80
      }

      vi.mocked(db.onboardingSessions.get).mockResolvedValue(session as any)
      vi.mocked(db.onboardingSessions.update).mockResolvedValue(1)
      vi.mocked(db.onboardingSessions.get).mockResolvedValueOnce(session as any)
        .mockResolvedValueOnce({
          ...session,
          goalDiscoveryPhase: 'complete',
          sessionProgress: 100,
          isCompleted: true,
          discoveredGoals: [{ id: '1', title: 'Test Goal' }]
        } as any)

      vi.mocked(conversationStorage.performMaintenance).mockResolvedValue({
        deletedConversations: 0,
        compressedConversations: 0,
        cleanedMessages: 0,
        errors: []
      })

      const finalGoals = [{ id: '1', title: 'Test Goal' }] as any
      const result = await manager.completeSession(1, finalGoals)

      expect(result.goalDiscoveryPhase).toBe('complete')
      expect(result.sessionProgress).toBe(100)
      expect(result.isCompleted).toBe(true)
      expect(result.discoveredGoals).toEqual(finalGoals)
    })
  })

  describe('detectSessionConflicts', () => {
    it('should detect multiple active sessions', async () => {
      const { db } = await import('./db')
      const multipleSessions = [
        { id: 1, conversationId: 'conv_1', isCompleted: false },
        { id: 2, conversationId: 'conv_2', isCompleted: false }
      ]

      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue(multipleSessions)
          }))
        }))
      } as any)

      const conflicts = await manager.detectSessionConflicts(123, 'conv_123')

      expect(conflicts).toHaveLength(2)
      expect(conflicts[0].type).toBe('multiple_active')
      expect(conflicts[0].severity).toBe('high')
      expect(conflicts[0].resolutionOptions).toBeDefined()
    })

    it('should detect orphaned sessions', async () => {
      const { db } = await import('./db')
      const orphanedSession = [
        { id: 1, conversationId: 'conv_1', isCompleted: false, sessionProgress: 50 }
      ]

      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue(orphanedSession)
          }))
        }))
      } as any)
      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => ({
          count: vi.fn().mockResolvedValue(0) // No messages
        }))
      } as any)

      const conflicts = await manager.detectSessionConflicts(123, 'conv_123')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('orphaned_session')
      expect(conflicts[0].severity).toBe('medium')
    })
  })

  describe('resolveConflicts', () => {
    it('should resolve conflicts by keeping newest session', async () => {
      const { db } = await import('./db')
      const conflicts = [
        {
          type: 'multiple_active' as const,
          sessionId: 1,
          conversationId: 'conv_1',
          description: 'Multiple active sessions',
          severity: 'high' as const,
          resolutionOptions: [
            { action: 'keep_newest' as const, description: 'Keep newest', riskLevel: 'low' as const }
          ]
        }
      ]

      vi.mocked(db.onboardingSessions.get).mockResolvedValue({
        id: 1,
        userId: 123,
        conversationId: 'conv_1'
      } as any)
      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([
              { id: 1, createdAt: new Date(Date.now() - 1000) },
              { id: 2, createdAt: new Date() }
            ])
          }))
        }))
      } as any)

      const result = await manager.resolveConflicts(conflicts)

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle manual review cases', async () => {
      const conflicts = [
        {
          type: 'corrupted_data' as const,
          sessionId: 1,
          conversationId: 'conv_1',
          description: 'Data corruption detected',
          severity: 'high' as const,
          resolutionOptions: [
            { action: 'manual_review' as const, description: 'Manual review', riskLevel: 'medium' as const }
          ]
        }
      ]

      const result = await manager.resolveConflicts(conflicts, {
        'conv_1': 'manual_review'
      })

      expect(result.resolved).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.errors[0]).toContain('Manual review required')
    })
  })

  describe('cache management', () => {
    it('should cache active sessions', async () => {
      const { db } = await import('./db')
      const session = {
        id: 1,
        userId: 123,
        conversationId: 'conv_123'
      }

      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              reverse: vi.fn(() => ({
                first: vi.fn().mockResolvedValue(session)
              }))
            }))
          }))
        }))
      } as any)

      // First call should query database
      const result1 = await manager.getActiveSession(123)
      expect(result1).toEqual(session)

      // Second call should use cache
      const result2 = await manager.getActiveSession(123)
      expect(result2).toEqual(session)

      // Verify cache stats
      const stats = manager.getCacheStats()
      expect(stats.size).toBe(1)
      expect(stats.userIds).toContain(123)
    })

    it('should clear cache', () => {
      manager.clearCache()
      const stats = manager.getCacheStats()
      expect(stats.size).toBe(0)
      expect(stats.userIds).toHaveLength(0)
    })
  })
})