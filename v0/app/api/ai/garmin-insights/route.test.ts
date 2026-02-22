import { beforeEach, describe, expect, it, vi } from "vitest"

const streamTextMock = vi.hoisted(() => vi.fn())
const buildInsightSummaryForUserMock = vi.hoisted(() => vi.fn())
const fetchLatestInsightMock = vi.hoisted(() => vi.fn())

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((model: string) => ({ model })),
}))

vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
}))

vi.mock("@/lib/server/garmin-insights-service", () => ({
  buildInsightSummaryForUser: (...args: unknown[]) => buildInsightSummaryForUserMock(...args),
  fetchLatestInsight: (...args: unknown[]) => fetchLatestInsightMock(...args),
}))

import { GET, POST } from "./route"

describe("/api/ai/garmin-insights", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = "test-key"
  })

  it("streams generated insight from structured summary", async () => {
    buildInsightSummaryForUserMock.mockResolvedValue({
      type: "daily",
      periodStart: "2026-02-22",
      periodEnd: "2026-02-22",
      confidence: "high",
      safetyFlags: [],
      sections: [],
      promptSummary: "- Readiness: Score 84",
      tokenEstimate: 24,
    })

    streamTextMock.mockReturnValue({
      toDataStreamResponse: () =>
        new Response('0:{"textDelta":"Your readiness is 84. Keep today controlled."}\n', {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    })

    const request = new Request("http://localhost:3000/api/ai/garmin-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: 42,
        insightType: "daily",
      }),
    })

    const response = await POST(request)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain("readiness is 84")
    expect(buildInsightSummaryForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        insightType: "daily",
      })
    )
  })

  it("returns latest stored insight via GET", async () => {
    fetchLatestInsightMock.mockResolvedValue({
      id: 1,
      type: "weekly",
      period_start: "2026-02-16",
      period_end: "2026-02-22",
      insight_markdown: "Load: 42km. Recovery: 7.2h sleep. Focus: keep one quality run.",
      confidence: 0.7,
      evidence_json: { source: "test" },
      created_at: "2026-02-22T21:00:00.000Z",
    })

    const request = new Request("http://localhost:3000/api/ai/garmin-insights?userId=42&type=weekly")
    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.insight.type).toBe("weekly")
    expect(payload.insight.text).toContain("42km")
  })
})

