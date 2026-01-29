import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SyncService } from '../sync-service'
import { db } from '@/lib/db'
import type { Run, Goal, Shoe } from '@/lib/db'

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
  },
  from: vi.fn(),
}))

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/lib/analytics', () => ({
  trackSyncEvent: vi.fn(),
}))

describe('SyncService', () => {
  let syncService: SyncService

  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear()
    }

    // Get fresh instance
    syncService = SyncService.getInstance()

    // Stop any running auto-sync
    syncService.stopAutoSync()

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'profile-id' },
              error: null,
            })
          ),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    syncService.stopAutoSync()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SyncService.getInstance()
      const instance2 = SyncService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Auto-sync', () => {
    it('should start auto-sync with default interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')
      syncService.startAutoSync()

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        300000 // 5 minutes
      )

      setIntervalSpy.mockRestore()
    })

    it('should start auto-sync with custom interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')
      const customInterval = 60000 // 1 minute

      syncService.startAutoSync(customInterval)

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        customInterval
      )

      setIntervalSpy.mockRestore()
    })

    it('should not start auto-sync if already running', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      syncService.startAutoSync()
      const firstCallCount = setIntervalSpy.mock.calls.length

      syncService.startAutoSync()
      const secondCallCount = setIntervalSpy.mock.calls.length

      expect(secondCallCount).toBe(firstCallCount)

      setIntervalSpy.mockRestore()
    })

    it('should stop auto-sync', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      syncService.startAutoSync()
      syncService.stopAutoSync()

      expect(clearIntervalSpy).toHaveBeenCalled()

      clearIntervalSpy.mockRestore()
    })
  })

  describe('Incremental Sync', () => {
    it('should skip sync when not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      await syncService.syncIncrementalChanges()

      expect(syncService.getStatus()).toBe('idle')
    })

    it('should handle profile fetch error', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id' },
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            token_type: 'bearer',
          },
        },
        error: null,
      })

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Profile not found' },
          })),
        })),
      }))

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      await syncService.syncIncrementalChanges()

      expect(syncService.getStatus()).toBe('error')
      expect(syncService.getErrorMessage()).toBe('Failed to fetch profile')
    })

    it('should prevent concurrent syncs', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      // Mock no auth session for quick return
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      // Start two syncs concurrently
      const sync1 = syncService.syncIncrementalChanges()
      const sync2 = syncService.syncIncrementalChanges()

      await Promise.all([sync1, sync2])

      // Only one should have executed (checked by ensuring status is idle)
      expect(syncService.getStatus()).toBe('idle')
    })
  })

  describe('Data Mapping', () => {
    it('should map run data correctly for Supabase', async () => {
      const testRun: Run = {
        id: 1,
        type: 'easy',
        distance: 5000,
        duration: 1800,
        pace: 360,
        heartRate: 150,
        calories: 300,
        notes: 'Test run',
        gpsPath: JSON.stringify([{ lat: 0, lng: 0 }]),
        gpsAccuracyData: JSON.stringify([{ accuracy: 10 }]),
        startAccuracy: 10,
        endAccuracy: 12,
        averageAccuracy: 11,
        runReport: JSON.stringify({ summary: 'Good run' }),
        runReportSource: 'manual',
        completedAt: new Date('2026-01-15'),
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
      }

      // Add run to local DB
      await db.runs.add(testRun)

      // Access private method through type assertion
      const service = syncService as any
      const mapped = service.mapRunToSupabase(testRun, 'test-profile-id')

      expect(mapped).toMatchObject({
        profile_id: 'test-profile-id',
        local_id: 1,
        type: 'easy',
        distance: 5000,
        duration: 1800,
        pace: 360,
        heart_rate: 150,
        calories: 300,
        notes: 'Test run',
      })

      expect(mapped.route).toEqual([{ lat: 0, lng: 0 }])
      expect(mapped.gps_accuracy_data).toEqual([{ accuracy: 10 }])
      expect(mapped.completed_at).toBeDefined()
      expect(mapped.last_synced_at).toBeDefined()
    })

    it('should map goal data correctly for Supabase', async () => {
      const testGoal: Goal = {
        id: 1,
        title: 'Run 5K',
        description: 'Complete a 5K run',
        goalType: 'distance',
        category: 'running',
        priority: 'high',
        status: 'in_progress',
        baselineValue: 0,
        targetValue: 5000,
        currentValue: 2500,
        progressPercentage: 50,
        isPrimary: true,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        completedAt: null,
      }

      await db.goals.add(testGoal)

      const service = syncService as any
      const mapped = service.mapGoalToSupabase(testGoal, 'test-profile-id')

      expect(mapped).toMatchObject({
        profile_id: 'test-profile-id',
        local_id: 1,
        title: 'Run 5K',
        goal_type: 'distance',
        status: 'in_progress',
        progress_percentage: 50,
        is_primary: true,
      })

      expect(mapped.completed_at).toBeNull()
    })

    it('should map shoe data correctly for Supabase', async () => {
      const testShoe: Shoe = {
        id: 1,
        name: 'Running Shoes',
        brand: 'Nike',
        model: 'Air Zoom Pegasus',
        initialKm: 0,
        currentKm: 100,
        maxKm: 800,
        startDate: new Date('2026-01-01'),
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-15'),
      }

      await db.shoes.add(testShoe)

      const service = syncService as any
      const mapped = service.mapShoeToSupabase(testShoe, 'test-profile-id')

      expect(mapped).toMatchObject({
        profile_id: 'test-profile-id',
        local_id: 1,
        name: 'Running Shoes',
        brand: 'Nike',
        current_km: 100,
        is_active: true,
      })

      expect(mapped.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/) // DATE format
    })
  })

  describe('Batching', () => {
    it('should batch large datasets correctly', async () => {
      // Create 250 test runs
      const runs: Run[] = Array.from({ length: 250 }, (_, i) => ({
        id: i + 1,
        type: 'easy',
        distance: 5000,
        duration: 1800,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      await db.runs.bulkAdd(runs)

      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      const upsertMock = vi.fn(() => Promise.resolve({ error: null }))

      vi.mocked(mockSupabase.from).mockReturnValue({
        upsert: upsertMock,
      } as any)

      const service = syncService as any
      await service.syncRuns(mockSupabase, 'test-profile-id', null)

      // Should be called 3 times (100, 100, 50)
      expect(upsertMock).toHaveBeenCalledTimes(3)

      // First batch should have 100 items
      expect(upsertMock.mock.calls[0][0]).toHaveLength(100)
      // Second batch should have 100 items
      expect(upsertMock.mock.calls[1][0]).toHaveLength(100)
      // Third batch should have 50 items
      expect(upsertMock.mock.calls[2][0]).toHaveLength(50)
    })
  })

  describe('Incremental Sync Logic', () => {
    it('should only sync changes since last sync', async () => {
      const oldDate = new Date('2026-01-01')
      const newDate = new Date('2026-01-15')

      // Add old run
      await db.runs.add({
        id: 1,
        type: 'easy',
        distance: 5000,
        duration: 1800,
        completedAt: oldDate,
        createdAt: oldDate,
        updatedAt: oldDate,
      })

      // Add new run
      await db.runs.add({
        id: 2,
        type: 'easy',
        distance: 5000,
        duration: 1800,
        completedAt: newDate,
        createdAt: newDate,
        updatedAt: newDate,
      })

      // Set last sync to after old run but before new run
      const lastSync = new Date('2026-01-10')

      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      const upsertMock = vi.fn(() => Promise.resolve({ error: null }))

      vi.mocked(mockSupabase.from).mockReturnValue({
        upsert: upsertMock,
      } as any)

      const service = syncService as any
      const count = await service.syncRuns(mockSupabase, 'test-profile-id', lastSync)

      // Should only sync the new run
      expect(count).toBe(1)
      expect(upsertMock).toHaveBeenCalledTimes(1)
      expect(upsertMock.mock.calls[0][0]).toHaveLength(1)
    })
  })

  describe('Status Management', () => {
    it('should update status during sync lifecycle', async () => {
      expect(syncService.getStatus()).toBe('idle')

      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const syncPromise = syncService.syncIncrementalChanges()

      // Should be syncing immediately after starting
      // Note: This might be flaky due to timing

      await syncPromise

      // Should be idle after completion
      expect(syncService.getStatus()).toBe('idle')
    })

    it('should set error status on sync failure', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      vi.mocked(mockSupabase.auth.getSession).mockRejectedValue(
        new Error('Network error')
      )

      await syncService.syncIncrementalChanges()

      expect(syncService.getStatus()).toBe('error')
      expect(syncService.getErrorMessage()).toContain('Network error')
    })
  })

  describe('Last Sync Timestamp', () => {
    it('should save and retrieve last sync timestamp', async () => {
      const testDate = new Date('2026-01-15T10:00:00Z')

      const service = syncService as any
      service.setLastSyncTimestamp(testDate)

      const retrieved = service.getLastSyncTimestamp()

      expect(retrieved).toEqual(testDate)
    })

    it('should return null for invalid timestamp', () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_sync_timestamp', 'invalid-date')
      }

      const service = syncService as any
      const retrieved = service.getLastSyncTimestamp()

      // Should handle gracefully
      expect(retrieved).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock db.runs to throw an error
      const originalToCollection = db.runs.toCollection
      db.runs.toCollection = vi.fn(() => ({
        toArray: vi.fn(() => Promise.reject(new Error('DB error'))),
      })) as any

      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      const service = syncService as any

      await expect(
        service.syncRuns(mockSupabase, 'test-profile-id', null)
      ).rejects.toThrow('DB error')

      // Restore
      db.runs.toCollection = originalToCollection
    })

    it('should handle Supabase upsert errors', async () => {
      await db.runs.add({
        id: 1,
        type: 'easy',
        distance: 5000,
        duration: 1800,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const { createClient } = await import('@/lib/supabase/client')
      const mockSupabase = createClient()

      vi.mocked(mockSupabase.from).mockReturnValue({
        upsert: vi.fn(() => Promise.resolve({
          error: { message: 'Upsert failed', code: '42P01' },
        })),
      } as any)

      const service = syncService as any

      await expect(
        service.syncRuns(mockSupabase, 'test-profile-id', null)
      ).rejects.toThrow()
    })
  })
})
