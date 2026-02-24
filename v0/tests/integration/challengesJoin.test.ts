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

const challengeStore = vi.hoisted(() => ({
  challenges: [
    {
      id: 'challenge-1',
      slug: 'start-running',
      title: '21-Day Start Running',
      description: 'Build a running habit.',
      duration_days: 21,
      rules: null,
    },
  ],
  enrollments: [] as Array<Record<string, unknown>>,
}))

function createAdminClientMock() {
  return {
    from(table: string) {
      if (table === 'challenges') {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                if (column !== 'id') {
                  throw new Error(`Unexpected column filter: ${column}`)
                }

                return {
                  async maybeSingle() {
                    const row = challengeStore.challenges.find((challenge) => challenge.id === value) ?? null
                    return { data: row, error: null }
                  },
                }
              },
            }
          },
          upsert() {
            return {
              select() {
                return {
                  async single() {
                    return { data: null, error: { message: 'not used in this test' } }
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'challenge_enrollments') {
        return {
          upsert(payload: Record<string, unknown>) {
            challengeStore.enrollments = [payload]
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: {
                        challenge_id: payload.challenge_id,
                        started_at: payload.started_at,
                        completed_at: null,
                        progress: payload.progress,
                      },
                      error: null,
                    }
                  },
                }
              },
            }
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
  return import('@/app/api/challenges/route')
}

describe('/api/challenges POST join', () => {
  beforeEach(() => {
    challengeStore.enrollments = []
  })

  it('creates enrollment for the selected challenge', async () => {
    const { POST } = await loadRoute()

    const req = new Request('http://localhost/api/challenges?userId=42', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': '42',
      },
      body: JSON.stringify({
        userId: 42,
        challengeId: 'challenge-1',
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.joined).toBe(true)
    expect(body.challenge.id).toBe('challenge-1')
    expect(challengeStore.enrollments).toHaveLength(1)
    expect(challengeStore.enrollments[0]?.user_id).toBe(42)
    expect(challengeStore.enrollments[0]?.challenge_id).toBe('challenge-1')
  })
})
