import { describe, expect, it } from "vitest"

import {
  buildGarminInsightSummary,
  estimateTokenCount,
  formatGarminContextForPrompt,
  type GarminCoachContext,
} from "@/lib/garminInsightBuilder"

describe("garminInsightBuilder", () => {
  it("builds a structured daily summary from derived inputs", () => {
    const summary = buildGarminInsightSummary({
      type: "daily",
      date: "2026-02-22",
      readinessScore: 84,
      readinessLabel: "Ready to Train",
      readinessConfidence: "high",
      sleepScore: 87,
      hrvDeltaPct: 12,
      acwr: 1.1,
      weeklyKm: 42,
      plannedWorkout: "tempo run",
      safetyFlags: [],
    })

    expect(summary.type).toBe("daily")
    expect(summary.confidence).toBe("high")
    expect(summary.sections).toHaveLength(3)
    expect(summary.promptSummary).toContain("Readiness")
    expect(summary.promptSummary).toContain("tempo run")
  })

  it("builds weekly summary with load/recovery/key run sections", () => {
    const summary = buildGarminInsightSummary({
      type: "weekly",
      periodStart: "2026-02-16",
      periodEnd: "2026-02-22",
      acwr: 1.08,
      weeklyVolumeKm: 42,
      keyRuns: [
        { date: "2026-02-22", sport: "running", km: 16.1, type: "long" },
        { date: "2026-02-20", sport: "running", km: 8.0, type: "tempo" },
      ],
      sleepHoursAvg: 7.2,
      stressAvg: 29,
      confidence: "high",
      safetyFlags: ["Load stable"],
    })

    expect(summary.type).toBe("weekly")
    expect(summary.sections[0]?.title).toBe("Load")
    expect(summary.sections[1]?.title).toBe("Recovery")
    expect(summary.sections[2]?.title).toBe("Key Runs")
    expect(summary.promptSummary).toContain("16.1 km")
  })

  it("formats Garmin coach context and respects token budget", () => {
    const context: GarminCoachContext = {
      lastSyncAt: "2h ago",
      readiness: { score: 84, label: "Ready to Train", confidence: "high" },
      load7d: { acwr: 1.1, zone: "sweet", weeklyKm: 42 },
      load28d: { avgWeeklyKm: 38, trend: "building" },
      sleep7dAvg: 7.2,
      lastWorkouts: Array.from({ length: 12 }, (_, index) => ({
        date: `2026-02-${String(index + 1).padStart(2, "0")}`,
        sport: "running",
        km: 10 + index,
        type: "easy",
      })),
    }

    const summary = formatGarminContextForPrompt(context, 800)
    const tokens = estimateTokenCount(summary)

    expect(summary).toContain("Readiness")
    expect(summary).toContain("7d load")
    expect(tokens).toBeLessThanOrEqual(800)
  })
})

