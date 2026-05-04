import { describe, expect, it } from 'vitest'
import { syncPlansAndWorkouts } from '../plan-workout-sync'
import type { Plan, Workout } from '@/lib/db'

function dated(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

describe('syncPlansAndWorkouts', () => {
  it('uses the auth UUID as the Supabase plan owner and preserves local IDs', async () => {
    const upserts: Record<string, unknown[][]> = { plans: [], workouts: [] }

    const supabase = {
      from(table: string) {
        return {
          upsert(payload: unknown[]) {
            upserts[table].push(payload)
            return {
              select() {
                return Promise.resolve({
                  data: [{ id: 'remote-plan-id', local_id: 11 }],
                  error: null,
                })
              },
              then(resolve: (value: { data: unknown[] | null; error: null }) => void) {
                return Promise.resolve(resolve({ data: null, error: null }))
              },
            }
          },
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({
                      data: [{ id: 'remote-plan-id', local_id: 11 }],
                      error: null,
                    })
                  },
                }
              },
            }
          },
        }
      },
    } as any

    const plan: Plan = {
      id: 11,
      userId: 1,
      title: '10K Build',
      startDate: dated('2026-05-04'),
      endDate: dated('2026-06-01'),
      totalWeeks: 4,
      isActive: true,
      planType: 'basic',
      createdAt: dated('2026-05-04'),
      updatedAt: dated('2026-05-04'),
    } as Plan

    const workout: Workout = {
      id: 21,
      planId: 11,
      week: 1,
      day: 'Mon',
      type: 'easy',
      distance: 5,
      completed: false,
      scheduledDate: dated('2026-05-04'),
      createdAt: dated('2026-05-04'),
      updatedAt: dated('2026-05-04'),
    } as Workout

    const stats = await syncPlansAndWorkouts(
      supabase,
      '068053fd-0000-4000-8000-000000000000',
      [plan],
      [workout],
      '[test]',
      '068053fd-0000-4000-8000-000000000000'
    )

    expect(stats).toEqual({ plans: 1, workouts: 1 })
    expect(upserts.plans[0][0]).toMatchObject({
      profile_id: '068053fd-0000-4000-8000-000000000000',
      auth_user_id: '068053fd-0000-4000-8000-000000000000',
      local_id: 11,
      title: '10K Build',
    })
    expect(upserts.workouts[0][0]).toMatchObject({
      plan_id: 'remote-plan-id',
      auth_user_id: '068053fd-0000-4000-8000-000000000000',
      local_id: 21,
      scheduled_date: '2026-05-04',
    })
  })
})
