import { beforeEach, describe, expect, it, vi } from "vitest"

const streamTextMock = vi.hoisted(() => vi.fn())
const buildGarminContextMock = vi.hoisted(() => vi.fn())
const buildGarminContextSummaryMock = vi.hoisted(() => vi.fn())

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((model: string) => ({ model })),
}))

vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
}))

vi.mock("@/lib/enhanced-ai-coach", () => ({
  buildGarminContext: (...args: unknown[]) => buildGarminContextMock(...args),
  buildGarminContextSummary: (...args: unknown[]) => buildGarminContextSummaryMock(...args),
}))

import { POST } from "@/app/api/chat/route"

describe("chat route Garmin context injection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = "test-key"

    buildGarminContextMock.mockResolvedValue({
      lastSyncAt: "2h ago",
      readiness: { score: 84, label: "Ready to Train", confidence: "high" },
      load7d: { acwr: 1.1, zone: "sweet", weeklyKm: 42 },
    })

    buildGarminContextSummaryMock.mockReturnValue(
      "- Last sync: 2h ago\n- Readiness: 84 (Ready to Train), confidence high\n- 7d load: ACWR 1.1 (sweet), weekly 42 km"
    )

    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield "You are trending well this week."
      })(),
    })
  })

  it("injects structured Garmin context into the system message", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "42",
        messages: [{ role: "user", content: "How am I doing?" }],
        userContext: "General profile context",
      }),
    })

    const response = await POST(request)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain("You are trending well this week.")
    expect(buildGarminContextMock).toHaveBeenCalledWith(42)
    expect(buildGarminContextSummaryMock).toHaveBeenCalledWith(expect.any(Object), 800)

    const streamCall = streamTextMock.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>
    }
    expect(streamCall.messages[0]?.role).toBe("system")
    expect(streamCall.messages[0]?.content).toContain("GARMIN STRUCTURED SUMMARY")
    expect(streamCall.messages[0]?.content).toContain("Readiness: 84")
  })
})

