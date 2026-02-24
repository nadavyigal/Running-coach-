const createClientMock = vi.hoisted(() =>
  vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: '00000000-0000-0000-0000-000000000042' },
        },
      })),
    },
  }))
)

type EnrollmentStore = {
  user_id: number
  auth_user_id: string | null
  challenge_id: string
  started_at: string
  completed_at: string | null
  progress: {
    completedDays: string[]
    completionSource: Record<string, 'garmin' | 'self_report'>
  }
  challenges: {
    duration_days: number
    slug: string
    title: string
  }
}

const progressStore = vi.hoisted(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startedAt = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`

  return {
    enrollment: {
      user_id: 42,
      auth_user_id: '00000000-0000-0000-0000-000000000042',
      challenge_id: 'challenge-1',
      started_at: startedAt,
      completed_at: null,
      progress: {
        completedDays: [],
        completionSource: {},
      },
      challenges: {
        duration_days: 21,
        slug: 'start-running',
        title: '21-Day Start Running',
      },
    } as EnrollmentStore,
    streakRow: {
      best_streak: 0,
    },
  }
})

function createAdminClientMock() {
  return {
    from(table: string) {
      if (table === 'challenge_enrollments') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                if (column !== 'user_id' || value !== 42) {
                  throw new Error(`Unexpected enrollment filter ${column}`)
                }

                return {
                  eq(nextColumn: string, nextValue: unknown) {
                    if (nextColumn !== 'challenge_id' || nextValue !== 'challenge-1') {
                      throw new Error(`Unexpected enrollment challenge filter ${nextColumn}`)
                    }

                    return {
                      async maybeSingle() {
                        return {
                          data: progressStore.enrollment,
                          error: null,
                        }
                      },
                    }
                  },
                }
              },
            }
          },
          update(payload: Partial<EnrollmentStore>) {
            progressStore.enrollment = {
              ...progressStore.enrollment,
              ...payload,
              progress: payload.progress ?? progressStore.enrollment.progress,
            }

            return {
              eq(column: string, value: unknown) {
                if (column !== 'user_id' || value !== 42) throw new Error('Unexpected update user filter')
                return {
                  async eq(nextColumn: string, nextValue: unknown) {
                    if (nextColumn !== 'challenge_id' || nextValue !== 'challenge-1') {
                      throw new Error('Unexpected update challenge filter')
                    }
                    return { error: null }
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'garmin_activities') {
        return {
          select() {
            return {
              eq() {
                return {
                  gte() {
                    return {
                      async lt() {
                        return {
                          data: [],
                          error: null,
                        }
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'user_streaks') {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                if (column !== 'user_id' || value !== 42) {
                  throw new Error('Unexpected streak user filter')
                }

                return {
                  async maybeSingle() {
                    return {
                      data: progressStore.streakRow,
                      error: null,
                    }
                  },
                }
              },
            }
          },
          upsert(payload: { best_streak: number }) {
            progressStore.streakRow.best_streak = payload.best_streak
            return { error: null }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => createAdminClientMock()),
}))

async function loadRoute() {
  return import('@/app/api/challenges/[id]/progress/route')
}

describe('/api/challenges/[id]/progress', () => {
  it('supports self-report completion and returns streak/progress state', async () => {
    const { GET } = await loadRoute()

    const req = new Request('http://localhost/api/challenges/challenge-1/progress?userId=42&selfReport=true', {
      method: 'GET',
      headers: {
        'x-user-id': '42',
      },
    })

    const res = await GET(req, { params: { id: 'challenge-1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.completedToday).toBe(true)
    expect(body.completedDays).toBe(1)
    expect(body.progressPercent).toBe(5)
    expect(body.streak.current).toBe(1)
    expect(body.sourceBreakdown.selfReport).toBe(1)
  })
})
