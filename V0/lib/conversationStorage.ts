import { db, type ConversationMessage, type OnboardingSession } from './db'
import { validateOnboardingState } from './onboardingStateValidator'

export interface ConversationData {
  messages: ConversationMessage[]
  session: OnboardingSession | null
  totalMessages: number
  lastUpdated: Date
  dataIntegrity: {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }
}

export interface ConversationCleanupConfig {
  maxMessagesPerConversation: number
  maxConversationAge: number // in days
  compressionThreshold: number // number of messages
  enableAutoCleanup: boolean
}

const DEFAULT_CLEANUP_CONFIG: ConversationCleanupConfig = {
  maxMessagesPerConversation: 500,
  maxConversationAge: 30,
  compressionThreshold: 100,
  enableAutoCleanup: true
}

/**
 * Core conversation storage utilities
 */
export class ConversationStorage {
  private cleanupConfig: ConversationCleanupConfig = DEFAULT_CLEANUP_CONFIG

  constructor(config?: Partial<ConversationCleanupConfig>) {
    this.cleanupConfig = { ...DEFAULT_CLEANUP_CONFIG, ...config }
  }

  /**
   * Save a message to conversation storage with validation
   */
  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>,
    phase?: string,
    sessionId?: number
  ): Promise<ConversationMessage> {
    try {
      // Input validation
      if (!conversationId || !content.trim()) {
        throw new Error('ConversationId and content are required')
      }

      if (content.length > 50000) { // 50KB limit per message
        throw new Error('Message content exceeds maximum allowed size')
      }

      const message: ConversationMessage = {
        sessionId,
        conversationId,
        role,
        content: content.trim(),
        timestamp: new Date(),
        metadata: metadata || {},
        phase,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const messageId = await db.conversationMessages.add(message)
      
      // Trigger cleanup if needed
      if (this.cleanupConfig.enableAutoCleanup) {
        await this.performMaintenanceIfNeeded(conversationId)
      }

      return { ...message, id: messageId }
    } catch (error) {
      console.error('Failed to save conversation message:', error)
      throw new Error(`Message storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Load conversation history with pagination support
   */
  async loadConversation(
    conversationId: string,
    options: {
      limit?: number
      offset?: number
      includeMetadata?: boolean
      validateIntegrity?: boolean
    } = {}
  ): Promise<ConversationData> {
    try {
      const { 
        limit = 100, 
        offset = 0, 
        includeMetadata = true, 
        validateIntegrity = true 
      } = options

      // Load messages with pagination
      let query = db.conversationMessages
        .where('conversationId')
        .equals(conversationId)
        .orderBy('timestamp')

      if (offset > 0) {
        query = query.offset(offset)
      }

      if (limit > 0) {
        query = query.limit(limit)
      }

      const messages = await query.toArray()
      
      // Get total count
      const totalMessages = await db.conversationMessages
        .where('conversationId')
        .equals(conversationId)
        .count()

      // Load associated session if exists
      const session = messages.length > 0 && messages[0].sessionId
        ? await db.onboardingSessions.get(messages[0].sessionId)
        : null

      // Strip metadata if not requested
      if (!includeMetadata) {
        messages.forEach(msg => {
          delete msg.metadata
        })
      }

      // Validate data integrity
      let dataIntegrity = { isValid: true, errors: [], warnings: [] }
      if (validateIntegrity) {
        dataIntegrity = await this.validateConversationIntegrity(conversationId, messages)
      }

      return {
        messages,
        session: session || null,
        totalMessages,
        lastUpdated: messages.length > 0 
          ? new Date(Math.max(...messages.map(m => m.updatedAt.getTime())))
          : new Date(),
        dataIntegrity
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      throw new Error(`Conversation loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all conversation IDs for a user
   */
  async getUserConversations(userId: number): Promise<string[]> {
    try {
      // Get conversations from sessions
      const sessions = await db.onboardingSessions
        .where('userId')
        .equals(userId)
        .toArray()

      const sessionConversationIds = sessions.map(s => s.conversationId)

      // Get any orphaned conversations (messages without sessions)
      const allMessages = await db.conversationMessages.toArray()
      const orphanedConversationIds = [
        ...new Set(
          allMessages
            .filter(m => !sessionConversationIds.includes(m.conversationId))
            .map(m => m.conversationId)
        )
      ]

      return [...sessionConversationIds, ...orphanedConversationIds]
    } catch (error) {
      console.error('Failed to get user conversations:', error)
      return []
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(conversationId: string): Promise<{
    messageCount: number
    userMessages: number
    assistantMessages: number
    averageMessageLength: number
    conversationDuration: number // in minutes
    phases: string[]
    storageSize: number // estimated bytes
  }> {
    try {
      const messages = await db.conversationMessages
        .where('conversationId')
        .equals(conversationId)
        .toArray()

      if (messages.length === 0) {
        return {
          messageCount: 0,
          userMessages: 0,
          assistantMessages: 0,
          averageMessageLength: 0,
          conversationDuration: 0,
          phases: [],
          storageSize: 0
        }
      }

      const userMessages = messages.filter(m => m.role === 'user').length
      const assistantMessages = messages.filter(m => m.role === 'assistant').length
      const averageMessageLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length
      
      const startTime = Math.min(...messages.map(m => m.timestamp.getTime()))
      const endTime = Math.max(...messages.map(m => m.timestamp.getTime()))
      const conversationDuration = Math.round((endTime - startTime) / 1000 / 60) // minutes

      const phases = [...new Set(messages.map(m => m.phase).filter(Boolean))]
      const storageSize = JSON.stringify(messages).length

      return {
        messageCount: messages.length,
        userMessages,
        assistantMessages,
        averageMessageLength: Math.round(averageMessageLength),
        conversationDuration,
        phases,
        storageSize
      }
    } catch (error) {
      console.error('Failed to get conversation stats:', error)
      throw new Error('Failed to retrieve conversation statistics')
    }
  }

  /**
   * Validate conversation data integrity
   */
  private async validateConversationIntegrity(
    conversationId: string,
    messages?: ConversationMessage[]
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const msgs = messages || await db.conversationMessages
        .where('conversationId')
        .equals(conversationId)
        .orderBy('timestamp')
        .toArray()

      // Check for duplicate messages
      const timestamps = msgs.map(m => m.timestamp.getTime())
      const duplicateTimestamps = timestamps.filter((t, i) => timestamps.indexOf(t) !== i)
      if (duplicateTimestamps.length > 0) {
        warnings.push(`Found ${duplicateTimestamps.length} messages with duplicate timestamps`)
      }

      // Check for orphaned messages (no session)
      const sessionIds = [...new Set(msgs.map(m => m.sessionId).filter(Boolean))]
      for (const sessionId of sessionIds) {
        const sessionExists = await db.onboardingSessions.get(sessionId!)
        if (!sessionExists) {
          warnings.push(`Messages reference non-existent session: ${sessionId}`)
        }
      }

      // Check message content integrity
      for (const msg of msgs) {
        if (!msg.content || msg.content.trim().length === 0) {
          errors.push(`Empty message content found at ${msg.timestamp}`)
        }
        
        if (msg.content.length > 50000) {
          warnings.push(`Message exceeds recommended size limit at ${msg.timestamp}`)
        }

        if (!['user', 'assistant'].includes(msg.role)) {
          errors.push(`Invalid message role '${msg.role}' at ${msg.timestamp}`)
        }
      }

      // Check conversation flow
      if (msgs.length > 0) {
        const firstMessage = msgs[0]
        if (firstMessage.role !== 'user') {
          warnings.push('Conversation does not start with user message')
        }

        // Check for conversation gaps (timestamps more than 24 hours apart)
        for (let i = 1; i < msgs.length; i++) {
          const timeDiff = msgs[i].timestamp.getTime() - msgs[i-1].timestamp.getTime()
          if (timeDiff > 24 * 60 * 60 * 1000) { // 24 hours
            warnings.push(`Large time gap detected between messages at ${msgs[i-1].timestamp} and ${msgs[i].timestamp}`)
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
      errors.push(`Integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { isValid: false, errors, warnings }
    }
  }

  /**
   * Clean up old conversations and perform maintenance
   */
  async performMaintenance(config?: Partial<ConversationCleanupConfig>): Promise<{
    deletedConversations: number
    compressedConversations: number
    cleanedMessages: number
    errors: string[]
  }> {
    const maintenanceConfig = { ...this.cleanupConfig, ...config }
    const results = {
      deletedConversations: 0,
      compressedConversations: 0,
      cleanedMessages: 0,
      errors: []
    }

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - maintenanceConfig.maxConversationAge)

      // Find old conversations to delete
      const oldSessions = await db.onboardingSessions
        .where('createdAt')
        .below(cutoffDate)
        .toArray()

      for (const session of oldSessions) {
        try {
          await this.deleteConversation(session.conversationId)
          results.deletedConversations++
        } catch (error) {
          results.errors.push(`Failed to delete conversation ${session.conversationId}: ${error}`)
        }
      }

      // Find conversations that need compression
      const allConversations = await this.getAllConversationIds()
      
      for (const conversationId of allConversations) {
        try {
          const messageCount = await db.conversationMessages
            .where('conversationId')
            .equals(conversationId)
            .count()

          if (messageCount > maintenanceConfig.compressionThreshold) {
            const compressed = await this.compressConversation(
              conversationId, 
              maintenanceConfig.maxMessagesPerConversation
            )
            if (compressed) {
              results.compressedConversations++
              results.cleanedMessages += (messageCount - maintenanceConfig.maxMessagesPerConversation)
            }
          }
        } catch (error) {
          results.errors.push(`Failed to compress conversation ${conversationId}: ${error}`)
        }
      }

      console.log('Maintenance completed:', results)
      return results
    } catch (error) {
      results.errors.push(`Maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return results
    }
  }

  /**
   * Compress a conversation by keeping only the most recent messages
   */
  private async compressConversation(conversationId: string, keepCount: number): Promise<boolean> {
    try {
      const messages = await db.conversationMessages
        .where('conversationId')
        .equals(conversationId)
        .orderBy('timestamp')
        .toArray()

      if (messages.length <= keepCount) {
        return false // No compression needed
      }

      const messagesToDelete = messages.slice(0, messages.length - keepCount)
      const deleteIds = messagesToDelete.map(m => m.id!).filter(Boolean)

      await db.conversationMessages.bulkDelete(deleteIds)
      
      console.log(`Compressed conversation ${conversationId}: removed ${deleteIds.length} old messages`)
      return true
    } catch (error) {
      console.error(`Failed to compress conversation ${conversationId}:`, error)
      return false
    }
  }

  /**
   * Delete an entire conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Delete messages
      await db.conversationMessages
        .where('conversationId')
        .equals(conversationId)
        .delete()

      // Delete associated session
      await db.onboardingSessions
        .where('conversationId')
        .equals(conversationId)
        .delete()

      console.log(`Deleted conversation: ${conversationId}`)
    } catch (error) {
      console.error(`Failed to delete conversation ${conversationId}:`, error)
      throw error
    }
  }

  /**
   * Get all conversation IDs in the database
   */
  private async getAllConversationIds(): Promise<string[]> {
    const sessions = await db.onboardingSessions.toArray()
    const sessionConversationIds = sessions.map(s => s.conversationId)

    const messages = await db.conversationMessages.toArray()
    const messageConversationIds = [...new Set(messages.map(m => m.conversationId))]

    return [...new Set([...sessionConversationIds, ...messageConversationIds])]
  }

  /**
   * Check if maintenance is needed and perform it
   */
  private async performMaintenanceIfNeeded(conversationId: string): Promise<void> {
    try {
      const messageCount = await db.conversationMessages
        .where('conversationId')
        .equals(conversationId)
        .count()

      // Perform compression if threshold exceeded
      if (messageCount > this.cleanupConfig.compressionThreshold) {
        await this.compressConversation(conversationId, this.cleanupConfig.maxMessagesPerConversation)
      }
    } catch (error) {
      console.warn('Maintenance check failed:', error)
      // Don't throw - maintenance failures shouldn't break normal operations
    }
  }

  /**
   * Export conversation data for backup/migration
   */
  async exportConversation(conversationId: string): Promise<{
    conversation: ConversationData
    exportedAt: Date
    version: string
  }> {
    try {
      const conversation = await this.loadConversation(conversationId, {
        includeMetadata: true,
        validateIntegrity: true
      })

      return {
        conversation,
        exportedAt: new Date(),
        version: '1.0'
      }
    } catch (error) {
      console.error('Failed to export conversation:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Import conversation data from backup
   */
  async importConversation(exportData: {
    conversation: ConversationData
    exportedAt: Date
    version: string
  }): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      const { conversation } = exportData

      // Validate import data
      if (!conversation.messages || !Array.isArray(conversation.messages)) {
        errors.push('Invalid conversation data: missing or invalid messages array')
        return { success: false, errors }
      }

      // Import session if exists
      if (conversation.session) {
        try {
          const existingSession = await db.onboardingSessions.get(conversation.session.id!)
          if (!existingSession) {
            await db.onboardingSessions.add(conversation.session)
          }
        } catch (error) {
          errors.push(`Failed to import session: ${error}`)
        }
      }

      // Import messages
      for (const message of conversation.messages) {
        try {
          const existingMessage = await db.conversationMessages.get(message.id!)
          if (!existingMessage) {
            await db.conversationMessages.add(message)
          }
        } catch (error) {
          errors.push(`Failed to import message ${message.id}: ${error}`)
        }
      }

      return { success: errors.length === 0, errors }
    } catch (error) {
      errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { success: false, errors }
    }
  }
}

// Create singleton instance
export const conversationStorage = new ConversationStorage()

// Export utility functions for backward compatibility
export const storageUtils = {
  saveMessage: conversationStorage.saveMessage.bind(conversationStorage),
  loadConversation: conversationStorage.loadConversation.bind(conversationStorage),
  getUserConversations: conversationStorage.getUserConversations.bind(conversationStorage),
  deleteConversation: conversationStorage.deleteConversation.bind(conversationStorage),
  performMaintenance: conversationStorage.performMaintenance.bind(conversationStorage),
  exportConversation: conversationStorage.exportConversation.bind(conversationStorage),
  importConversation: conversationStorage.importConversation.bind(conversationStorage)
}