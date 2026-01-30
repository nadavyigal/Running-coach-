import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the database module
vi.mock('../lib/db', () => ({
  getDatabase: vi.fn(),
  isDatabaseAvailable: vi.fn(() => true),
  safeDbOperation: vi.fn(),
  resetDatabaseInstance: vi.fn()
}))

vi.mock('@/lib/migrations/clearTelAvivRoutesMigration', () => ({
  runClearTelAvivRoutesMigration: vi.fn().mockResolvedValue({
    migrationRun: false,
    routesCleared: 0,
    message: 'Migration already completed',
  }),
}))

vi.mock('@/lib/migrations/migrateExistingGoals', () => ({
  migrateExistingGoals: vi.fn().mockResolvedValue({ migrated: 0, errors: [] }),
}))

import { performStartupMigration } from '@/lib/dbUtils'
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

  describe('User cleanup scenarios', () => {
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

    it('should remove redundant completed users and drafts when a completed user exists', async () => {
      // Arrange
      const completedOlder = {
        id: 1,
        onboardingComplete: true,
        updatedAt: new Date('2024-01-01'),
      }
      const completedNewer = {
        id: 2,
        onboardingComplete: true,
        updatedAt: new Date('2024-01-02'),
      }
      const draftUser = {
        id: 3,
        onboardingComplete: false,
        updatedAt: new Date('2024-01-03'),
      }
      const draftUser2 = {
        id: 4,
        onboardingComplete: false,
        updatedAt: new Date('2024-01-04'),
      }

      mockDatabase.users.toArray.mockResolvedValue([
        completedOlder,
        completedNewer,
        draftUser,
        draftUser2,
      ])
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act  
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(true)
      const deleteArgs = mockDatabase.users.anyOf.mock.calls[0][0]
      expect(deleteArgs).toEqual(expect.arrayContaining([1, 3, 4]))
      expect(deleteArgs).toHaveLength(3)
      expect(mockDatabase.users.delete).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:users] Kept user 2; removed 3 duplicates/drafts')
    })

    it('should remove redundant drafts when only drafts exist', async () => {
      // Arrange
      const olderDraft = {
        id: 1,
        onboardingComplete: false,
        updatedAt: new Date('2024-01-01'),
      }
      
      const newerDraft = {
        id: 2,  
        onboardingComplete: false,
        updatedAt: new Date('2024-01-02'),
      }
      
      mockDatabase.users.toArray.mockResolvedValue([olderDraft, newerDraft])
      mockDatabase.users.delete.mockResolvedValue(undefined)
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act
      const result = await performStartupMigration()
      
      // Assert
      expect(result).toBe(true)
      
      // Should cleanup the older draft (id: 1), keeping the latest
      expect(mockDatabase.users.anyOf).toHaveBeenCalledWith([1])
      expect(mockDatabase.users.delete).toHaveBeenCalled()
      
      expect(consoleLogSpy).toHaveBeenCalledWith('[migration:users] Kept draft user 2; removed 1 redundant drafts')
    })

    it('should not delete when only one draft exists', async () => {
      const draftUser = {
        id: 1,
        onboardingComplete: false,
        updatedAt: new Date('2024-01-01'),
      }

      mockDatabase.users.toArray.mockResolvedValue([draftUser])
      mockDatabase.open.mockResolvedValue(undefined)

      const result = await performStartupMigration()

      expect(result).toBe(true)
      expect(mockDatabase.users.anyOf).not.toHaveBeenCalled()
      expect(mockDatabase.users.delete).not.toHaveBeenCalled()
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

    it('should handle user cleanup failures', async () => {
      // Arrange
      const olderDraft = { id: 1, onboardingComplete: false, updatedAt: new Date('2024-01-01') }
      const newerDraft = { id: 2, onboardingComplete: false, updatedAt: new Date('2024-01-02') }
      
      mockDatabase.users.toArray.mockResolvedValue([olderDraft, newerDraft])
      mockDatabase.open.mockResolvedValue(undefined)
      mockDatabase.users.delete.mockRejectedValue(new Error('Delete failed'))
      
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
      const olderDraft = { id: 1, onboardingComplete: false, updatedAt: new Date('2024-01-01') }
      const newerDraft = { id: 2, onboardingComplete: false, updatedAt: new Date('2024-01-02') }
      
      mockDatabase.users.toArray.mockResolvedValue([olderDraft, newerDraft])
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Simulate delay in delete to create race condition window
      let deleteCallCount = 0
      mockDatabase.users.delete.mockImplementation(async () => {
        deleteCallCount++
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
      
      // Cleanup should be attempted for each migration attempt
      expect(deleteCallCount).toBeGreaterThanOrEqual(1)
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
      mockDatabase.users.delete.mockResolvedValue(undefined)
      mockDatabase.open.mockResolvedValue(undefined)
      
      // Act
      const result = await performStartupMigration()
      const duration = Date.now() - startTime
      
      // Assert
      expect(result).toBe(true)
      expect(duration).toBeLessThan(300) // Should complete in under 300ms
      
      // Should keep the latest (id: 10) and clean up others
      expect(mockDatabase.users.anyOf).toHaveBeenCalledWith([9, 8, 7, 6, 5, 4, 3, 2, 1]) // Order reflects reverse sorting by date
    })
  })
})
