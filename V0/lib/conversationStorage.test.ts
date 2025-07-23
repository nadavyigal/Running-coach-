import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { conversationStorage, ConversationStorage } from './conversationStorage'
import { sessionManager } from './sessionManager'

// Mock the database
vi.mock('./db', () => ({
  db: {
    conversationMessages: {
      add: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            offset: vi.fn(() => ({
              limit: vi.fn(() => ({
                toArray: vi.fn()
              }))
            })),
            limit: vi.fn(() => ({
              toArray: vi.fn()
            })),
            toArray: vi.fn()
          })),
          count: vi.fn(),
          delete: vi.fn()
        }))
      })),
      toArray: vi.fn(),
      bulkDelete: vi.fn()
    },
    onboardingSessions: {
      get: vi.fn(),
      add: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn()
        }))
      })),
      toArray: vi.fn()
    }
  }
}))

vi.mock('./onboardingStateValidator', () => ({
  validateOnboardingState: vi.fn(() => ({
    isValid: true,
    errors: [],
    warnings: []
  }))
}))

describe('ConversationStorage', () => {
  let storage: ConversationStorage

  beforeEach(() => {
    storage = new ConversationStorage()
    vi.clearAllMocks()
  })

  describe('saveMessage', () => {
    it('should save a message successfully', async () => {
      const mockAdd = vi.fn().mockResolvedValue(1)
      const { db } = await import('./db')
      vi.mocked(db.conversationMessages.add).mockImplementation(mockAdd)

      const result = await storage.saveMessage(
        'conv_123',
        'user',
        'Hello world',
        { test: true },
        'motivation',
        1
      )

      expect(mockAdd).toHaveBeenCalledWith({
        sessionId: 1,
        conversationId: 'conv_123',
        role: 'user',
        content: 'Hello world',
        timestamp: expect.any(Date),
        metadata: { test: true },
        phase: 'motivation',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })

      expect(result).toMatchObject({
        id: 1,
        conversationId: 'conv_123',
        role: 'user',
        content: 'Hello world'
      })
    })

    it('should validate input parameters', async () => {
      await expect(
        storage.saveMessage('', 'user', 'content')
      ).rejects.toThrow('ConversationId and content are required')

      await expect(
        storage.saveMessage('conv_123', 'user', '')
      ).rejects.toThrow('ConversationId and content are required')
    })

    it('should handle message size limits', async () => {
      const longContent = 'a'.repeat(60000)
      
      await expect(
        storage.saveMessage('conv_123', 'user', longContent)
      ).rejects.toThrow('Message content exceeds maximum allowed size')
    })
  })

  describe('loadConversation', () => {
    it('should load conversation with messages', async () => {
      const mockMessages = [
        {
          id: 1,
          conversationId: 'conv_123',
          role: 'user' as const,
          content: 'Hello',
          timestamp: new Date(),
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const { db } = await import('./db')
      const mockQuery = {
        orderBy: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(mockMessages)
        }))
      }
      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => mockQuery)
      } as any)
      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => ({
          count: vi.fn().mockResolvedValue(1)
        }))
      } as any)

      const result = await storage.loadConversation('conv_123')

      expect(result.messages).toHaveLength(1)
      expect(result.totalMessages).toBe(1)
      expect(result.dataIntegrity.isValid).toBe(true)
    })

    it('should handle pagination options', async () => {
      const { db } = await import('./db')
      const mockOffset = vi.fn(() => ({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([])
        }))
      }))
      const mockQuery = {
        orderBy: vi.fn(() => ({
          offset: mockOffset
        }))
      }
      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => mockQuery)
      } as any)

      await storage.loadConversation('conv_123', {
        limit: 10,
        offset: 5,
        includeMetadata: false
      })

      expect(mockOffset).toHaveBeenCalledWith(5)
    })
  })

  describe('performMaintenance', () => {
    it('should clean up old conversations', async () => {
      const { db } = await import('./db')
      const oldSessions = [
        {
          id: 1,
          conversationId: 'old_conv',
          createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) // 35 days ago
        }
      ]

      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        below: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue(oldSessions)
        }))
      } as any)

      const mockDeleteMessages = vi.fn()
      const mockDeleteSession = vi.fn()
      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => ({
          delete: mockDeleteMessages
        }))
      } as any)
      vi.mocked(db.onboardingSessions.where).mockReturnValue({
        equals: vi.fn(() => ({
          delete: mockDeleteSession
        }))
      } as any)

      const result = await storage.performMaintenance()

      expect(result.deletedConversations).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateConversationIntegrity', () => {
    it('should validate message integrity', async () => {
      const validMessages = [
        {
          id: 1,
          conversationId: 'conv_123',
          role: 'user' as const,
          content: 'Valid message',
          timestamp: new Date(),
          sessionId: 1,
          metadata: {},
          phase: 'motivation',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const { db } = await import('./db')
      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue(validMessages)
          }))
        }))
      } as any)
      vi.mocked(db.onboardingSessions.get).mockResolvedValue({
        id: 1,
        userId: 123,
        conversationId: 'conv_123'
      } as any)

      const result = await storage.loadConversation('conv_123', {
        validateIntegrity: true
      })

      expect(result.dataIntegrity.isValid).toBe(true)
      expect(result.dataIntegrity.errors).toHaveLength(0)
    })
  })

  describe('exportConversation', () => {
    it('should export conversation data', async () => {
      const { db } = await import('./db')
      const mockMessages = [
        {
          id: 1,
          conversationId: 'conv_123',
          role: 'user' as const,
          content: 'Test message',
          timestamp: new Date(),
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      vi.mocked(db.conversationMessages.where).mockReturnValue({
        equals: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue(mockMessages)
          })),
          count: vi.fn().mockResolvedValue(1)
        }))
      } as any)

      const result = await storage.exportConversation('conv_123')

      expect(result.conversation.messages).toHaveLength(1)
      expect(result.exportedAt).toBeInstanceOf(Date)
      expect(result.version).toBe('1.0')
    })
  })
})

describe('SessionManager Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create and manage sessions', async () => {
    const { db } = await import('./db')
    vi.mocked(db.onboardingSessions.add).mockResolvedValue(1)
    vi.mocked(db.onboardingSessions.where).mockReturnValue({
      equals: vi.fn(() => ({
        and: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([])
        }))
      }))
    } as any)

    const result = await sessionManager.createSession({
      userId: 123,
      initialPhase: 'motivation'
    })

    expect(result.session).toBeDefined()
    expect(result.session.userId).toBe(123)
    expect(result.session.goalDiscoveryPhase).toBe('motivation')
    expect(result.wasResumed).toBe(false)
  })

  it('should detect session conflicts', async () => {
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

    const conflicts = await sessionManager.detectSessionConflicts(123, 'conv_123')

    expect(conflicts).toHaveLength(2)
    expect(conflicts[0].type).toBe('multiple_active')
  })
})