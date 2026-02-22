import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const tableRows = vi.hoisted(() => ({
  training_derived_metrics: [] as Record<string, unknown>[],
  garmin_daily_metrics: [] as Record<string, unknown>[],
  garmin_activities: [] as Record<string, unknown>[],
}))

const createAdminClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: tableRows[table as keyof typeof tableRows] ?? [],
              error: null,
            }),
          }),
        }),
      }),
    }),
  }))
)

const getGarminOAuthStateMock = vi.hoisted(() =>
  vi.fn(async () => ({
    lastSyncAt: "2026-02-22T08:00:00.000Z",
  }))
)

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock("@/lib/server/garmin-oauth-store", () => ({
  getGarminOAuthState: getGarminOAuthStateMock,
}))

describe("buildGarminContext", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-22T10:00:00.000Z"))

    tableRows.training_derived_metrics = []
    tableRows.garmin_daily_metrics = []
    tableRows.garmin_activities = []
    getGarminOAuthStateMock.mockResolvedValue({
      lastSyncAt: "2026-02-22T08:00:00.000Z",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns Garmin context shape with readiness/load/workouts", async () => {
    tableRows.training_derived_metrics = [
      {
        date: "2026-02-22",
        acwr: 1.1,
        weekly_volume_m: 42000,
        weekly_intensity_score: 84,
        flags_json: {
          confidence: "high",
          readiness: { score: 84, label: "Ready to Train", confidence: "high" },
          acwr: { zone: "sweet" },
        },
      },
      {
        date: "2026-02-20",
        acwr: 1.0,
        weekly_volume_m: 38000,
        weekly_intensity_score: 76,
        flags_json: {},
      },
    ]
    tableRows.garmin_daily_metrics = [
      { date: "2026-02-22", sleep_duration_s: 27000, training_readiness: 84 },
      { date: "2026-02-21", sleep_duration_s: 25200, training_readiness: 80 },
      { date: "2026-02-20", sleep_duration_s: 26100, training_readiness: 75 },
    ]
    tableRows.garmin_activities = [
      { start_time: "2026-02-22T06:00:00.000Z", sport: "running", distance_m: 12000, avg_hr: 148 },
      { start_time: "2026-02-20T06:00:00.000Z", sport: "running", distance_m: 8000, avg_hr: 158 },
      { start_time: "2026-02-18T06:00:00.000Z", sport: "running", distance_m: 6000, avg_hr: 140 },
    ]

    const {
      buildGarminContext,
      buildGarminContextSummary,
      getGarminContextTokenEstimate,
    } = await import("@/lib/enhanced-ai-coach")

    const context = await buildGarminContext(42)
    const summary = buildGarminContextSummary(context, 800)
    const tokenEstimate = getGarminContextTokenEstimate(context, 800)

    expect(context).toMatchObject({
      lastSyncAt: "2h ago",
      readiness: {
        score: 84,
        label: "Ready to Train",
        confidence: "high",
      },
      load7d: {
        acwr: 1.1,
        zone: "sweet",
        weeklyKm: 42,
      },
    })
    expect(context.load28d?.avgWeeklyKm).toBeGreaterThan(0)
    expect(context.lastWorkouts).toHaveLength(3)
    expect(summary).toContain("Readiness")
    expect(tokenEstimate).toBeLessThanOrEqual(800)
  })

  it("gracefully omits unavailable fields when data is missing", async () => {
    getGarminOAuthStateMock.mockResolvedValue(null)

    const { buildGarminContext } = await import("@/lib/enhanced-ai-coach")
    const context = await buildGarminContext(42)

    expect(context.readiness).toBeUndefined()
    expect(context.load7d).toBeUndefined()
    expect(context.sleep7dAvg).toBeUndefined()
    expect(context.lastWorkouts).toBeUndefined()
  })
})

