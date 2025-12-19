import { describe, it, expect, vi, beforeEach } from "vitest"
import { analyzeActivityImage } from "../ai-activity-client"

describe("analyzeActivityImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("normalizes confidence 0..1 to 0..100 and converts minutes to seconds", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: {
          type: "run",
          distance: 5,
          durationMinutes: 30,
          paceSeconds: 360,
          calories: 300,
          notes: "Nice run",
          date: "2025-12-01T10:00:00.000Z",
        },
        confidence: 0.6,
      }),
    })

    ;(globalThis as any).fetch = mockFetch

    const file = new File(["x"], "test.png", { type: "image/png" })
    const result = await analyzeActivityImage(file)

    expect(result.distanceKm).toBe(5)
    expect(result.durationSeconds).toBe(1800)
    expect(result.paceSecondsPerKm).toBe(360)
    expect(result.confidence).toBe(60)
  })

  it("prefers durationSeconds when provided by the API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: {
          type: "run",
          distance: 10,
          durationMinutes: 50,
          durationSeconds: 3010,
          date: "2025-12-01T10:00:00.000Z",
        },
        confidence: 80,
      }),
    })

    ;(globalThis as any).fetch = mockFetch

    const file = new File(["x"], "test.webp", { type: "image/webp" })
    const result = await analyzeActivityImage(file)

    expect(result.durationSeconds).toBe(3010)
    expect(result.confidence).toBe(80)
  })

  it("throws a useful error when the API fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unsupported file type" }),
    })

    ;(globalThis as any).fetch = mockFetch

    const file = new File(["x"], "test.heic", { type: "image/heic" })
    await expect(analyzeActivityImage(file)).rejects.toThrow("Unsupported file type")
  })
})

