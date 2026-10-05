import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@ai-sdk/openai", () => ({
  openai: (model: string) => ({ model }),
}))

const generateObjectMock = vi.fn()
const generateTextMock = vi.fn()

vi.mock("ai", () => ({
  generateObject: (...args: any[]) => generateObjectMock(...args),
  generateText: (...args: any[]) => generateTextMock(...args),
}))

import { POST } from "./route"

describe("/api/ai-activity", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.OPENAI_API_KEY = "test-key"
  })

  const makeReq = (formData: FormData) =>
    ({
      headers: new Headers(),
      formData: async () => formData,
    }) as any as Request

  it("returns 400 for missing file", async () => {
    const req = makeReq(new FormData())
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.errorCode).toBe("missing_file")
    expect(typeof body.requestId).toBe("string")
  })

  it("returns success for structured extraction", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        type: "run",
        distance_km: 5,
        duration_seconds: 1800,
        pace_seconds_per_km: 360,
        calories: 300,
        confidence_pct: 82,
      },
    })

    const form = new FormData()
    const file = new File(["x"], "test.png", { type: "image/png" })
    if (typeof (file as any).arrayBuffer !== "function") {
      ;(file as any).arrayBuffer = async () => new Uint8Array([120]).buffer
    }
    form.set("file", file)
    const req = makeReq(form)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activity.distance).toBe(5)
    expect(body.activity.durationSeconds).toBe(1800)
    expect(body.confidence).toBe(82)
    expect(body.meta.method).toBe("vision_structured")
    expect(body.meta.preprocessing).toEqual(["skipped(test)"])
  })

  it("falls back to text transcription when structured is missing fields", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: { confidence_pct: 40 } })
    generateTextMock.mockResolvedValueOnce({
      text: "Distance 5.01 km\nTime 25:30\nAvg Pace 5:05 /km\nCalories 320 kcal\n",
    })

    const form = new FormData()
    const file = new File(["x"], "test.png", { type: "image/png" })
    if (typeof (file as any).arrayBuffer !== "function") {
      ;(file as any).arrayBuffer = async () => new Uint8Array([120]).buffer
    }
    form.set("file", file)
    const req = makeReq(form)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.meta.method).toBe("vision_text_fallback")
    expect(body.activity.distance).toBeCloseTo(5.01)
    expect(body.activity.durationSeconds).toBe(1530)
  })
})
