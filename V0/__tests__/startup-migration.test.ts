import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the database module
vi.mock('../lib/db', () => ({
  getDatabase: vi.fn(),
  isDatabaseAvailable: vi.fn(() => true),
  safeDbOperation: vi.fn()
}))

import { performStartupMigration } from '../lib/dbUtils'
import { getDatabase } from '../lib/db'

describe('Startup Migration', () => {
  let mockDatabase: any
  let consoleLogSpy: any
  let consoleErrorSpy: any

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Create mock database
    mockDatabase = {
      users: {
        where: vi.fn().mockReturnThis(),
        equals: vi.fn().mockReturnThis(), 
        toArray: vi.fn(),
        update: vi.fn(),
        anyOf: vi.fn().mockReturnThis(),
        delete: vi.fn()
      },
      open: vi.fn()
    }
    
    // Mock getDatabase
    vi.mocked(getDatabase).mockReturnValue(mockDatabase)
    
    // Mock safeDbOperation to execute callback
    const { safeDbOperation } = await import('../lib/db')
    vi.mocked(safeDbOperation).mockImplementation(async (callback: () => any) => {
      return await callback()
    })
    
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('Draft user migration scenarios', () => {
    it('should handle cold start with no existing users', async () => {
      // Arrange
      mockDatabase.users.toArray.mockResolvedValue([])
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(true)
      expect(mockDatabase.open).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:complete] Startup migration completed successfully')
    })

    it('should promote single draft user to canonical', async () => {
      // Arrange
      const draftUser = {
        id: 1,
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        onboardingComplete: false,
        consents: { data: true, gdpr: true, push: true },
        updatedAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01')
      }
      
      mockDatabase.users.toArray.mockResolvedValue([draftUser])
      mockDatabase.users.update.mockResolvedValue(undefined)
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act  
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(true)
      expect(mockDatabase.users.update).toHaveBeenCalledWith(1, expect.objectContaining({
        goal: 'habit',
        experience: 'beginner',
        onboardingComplete: true,
        updatedAt: expect.any(Date)
      }))
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:promote] Found 1 draft profiles to promote')
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:promoted] Promoted draft user 1 to canonical')
    })

    it('should promote latest draft and cleanup others', async () => {
      // Arrange
      const olderDraft = {
        id: 1,
        goal: 'habit',
        onboardingComplete: false,
        updatedAt: new Date('2024-01-01'),
        consents: { data: true, gdpr: true, push: false }
      }
      
      const newerDraft = {
        id: 2,  
        goal: 'distance',
        experience: 'intermediate',
        onboardingComplete: false,
        updatedAt: new Date('2024-01-02'),
        consents: { data: true, gdpr: true, push: true }
      }
      
      mockDatabase.users.toArray.mockResolvedValue([olderDraft, newerDraft])
      mockDatabase.users.update.mockResolvedValue(undefined)
      mockDatabase.users.delete.mockResolvedValue(undefined)
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(true)
      
      // Should promote the newer draft (id: 2)
      expect(mockDatabase.users.update).toHaveBeenCalledWith(2, expect.objectContaining({
        goal: 'distance',
        experience: 'intermediate', 
        onboardingComplete: true,
        updatedAt: expect.any(Date)
      }))
      
      // Should cleanup the older draft (id: 1)
      expect(mockDatabase.users.anyOf).toHaveBeenCalledWith([1])
      expect(mockDatabase.users.delete).toHaveBeenCalled()
      
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:promoted] Promoted draft user 2 to canonical')
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:cleanup] Removed 1 redundant draft users')
    })

    it('should handle schema upgrades by filling missing fields', async () => {
      // Arrange - draft user with missing optional fields
      const incompleteDraft = {
        id: 1,
        onboardingComplete: false,
        updatedAt: new Date(),
        // Missing: goal, experience, preferredTimes, daysPerWeek, consents
      }
      
      mockDatabase.users.toArray.mockResolvedValue([incompleteDraft])
      mockDatabase.users.update.mockResolvedValue(undefined)
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(true)
      expect(mockDatabase.users.update).toHaveBeenCalledWith(1, expect.objectContaining({
        goal: 'habit', // Default value
        experience: 'beginner', // Default value 
        preferredTimes: ['morning'], // Default value
        daysPerWeek: 3, // Default value
        consents: { data: true, gdpr: true, push: false }, // Default value
        onboardingComplete: true,
        updatedAt: expect.any(Date)
      }))
    })
  })

  describe('Error handling', () => {
    it('should handle database connection failures gracefully', async () => {
      // Arrange
      mockDatabase.open.mockRejectedValue(new Error('Connection failed'))
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[migration:error] Startup migration failed:', expect.any(Error))
    })

    it('should handle user query failures gracefully', async () => {
      // Arrange
      mockDatabase.open.mockResolvedValue(undefined)
      mockDatabase.users.toArray.mockRejectedValue(new Error('Query failed'))
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[migration:error] Startup migration failed:', expect.any(Error))
    })

    it('should not block startup when database unavailable', async () => {
      // Arrange
      vi.mocked(getDatabase).mockReturnValue(null)
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(true) // Should return true to not block startup
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:skip] Database not available')
    })

    it('should handle user update failures', async () => {
      // Arrange
      const draftUser = { id: 1, onboardingComplete: false, updatedAt: new Date() }
      
      mockDatabase.users.toArray.mockResolvedValue([draftUser])
      mockDatabase.open.mockResolvedValue(undefined)
      mockDatabase.users.update.mockRejectedValue(new Error('Update failed'))
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[migration:error] Startup migration failed:', expect.any(Error))
    })
  })

  describe('Race condition handling', () => {
    it('should handle concurrent migration attempts', async () => {
      // Arrange
      const draftUser = { id: 1, onboardingComplete: false, updatedAt: new Date() }
      
      mockDatabase.users.toArray.mockResolvedValue([draftUser])
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Simulate delay in update to create race condition window
      let updateCallCount = 0
      mockDatabase.users.update.mockImplementation(async () => {
        updateCallCount++
        await new Promise(resolve => setTimeout(resolve, 10))
        return undefined
      })
      
      // Act - run migration concurrently  
      const [result1, result2] = await Promise.all([
        performStartupMigration(),
        performStartupMigration()
      ])
      
      // Assert - both should succeed
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      
      // Update should be called for each migration attempt
      expect(updateCallCount).toBeGreaterThanOrEqual(1)
    }, 10000) // Increase timeout for this test
  })

  describe('Performance characteristics', () => {
    it('should complete migration within reasonable time', async () => {
      // Arrange
      const startTime = Date.now()
      const manyDrafts = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        onboardingComplete: false,
        updatedAt: new Date(2024, 0, i + 1) // Spread over dates
      }))
      
      mockDatabase.users.toArray.mockResolvedValue(manyDrafts)
      mockDatabase.users.update.mockResolvedValue(undefined)
      mockDatabase.users.delete.mockResolvedValue(undefined)
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act
      const result = await performStartupMigration()
      const duration = Date.now() - startTime
      
      // Assert
      expect(result).toBe(true)
      expect(duration).toBeLessThan(300) // Should complete in under 300ms
      
      // Should promote the latest (id: 10) and clean up others
      expect(mockDatabase.users.update).toHaveBeenCalledWith(10, expect.any(Object))
      expect(mockDatabase.users.anyOf).toHaveBeenCalledWith([9, 8, 7, 6, 5, 4, 3, 2, 1]) // Order reflects reverse sorting by date
    })
  })
})