import { afterEach, describe, expect, it } from "vitest"
import { CURRENT_MODELS, providerOptionsFor, selectModel, selectionForModel } from "./models"

const KEYS = [
  "OPENAI_MODEL_PLAN", "OPENAI_MODEL_WRITER", "OPENAI_MODEL_FAST", "OPENAI_MODEL_VISION", "OPENAI_MODEL_VISION_OCR",
  "OPENAI_REASONING_EFFORT_PLAN", "OPENAI_REASONING_EFFORT_FAST", "OPENAI_MODEL", "RUN_REPORT_MODEL",
]

afterEach(() => {
  for (const key of KEYS) delete process.env[key]
})

describe("selectModel", () => {
  it("defaults every tier to the model used before tiers existed", () => {
    expect(CURRENT_MODELS).toEqual({ PLAN: "gpt-4o", WRITER: "gpt-4o", FAST: "gpt-4o-mini", VISION: "gpt-4o", VISION_OCR: "gpt-4o-mini" })
    expect(selectModel("PLAN")).toEqual({ tier: "PLAN", model: "gpt-4o" })
    expect(providerOptionsFor(selectModel("FAST"))).toBeUndefined()
  })

  it("reads the tier env var and the tier default effort", () => {
    process.env.OPENAI_MODEL_PLAN = "gpt-6.2-sol"
    process.env.OPENAI_MODEL_FAST = "gpt-6-luna"
    expect(selectModel("PLAN")).toEqual({ tier: "PLAN", model: "gpt-6.2-sol", reasoningEffort: "low" })
    expect(providerOptionsFor(selectModel("FAST"))).toEqual({ openai: { reasoningEffort: "none" } })
  })

  it("older per-feature env vars keep priority, first one wins", () => {
    process.env.OPENAI_MODEL_FAST = "gpt-6-luna"
    process.env.RUN_REPORT_MODEL = "gpt-4o"
    expect(selectModel("FAST", { overrideEnv: ["RUN_REPORT_MODEL"] }).model).toBe("gpt-4o")
    expect(selectModel("FAST", { overrideEnv: ["OPENAI_MODEL", "RUN_REPORT_MODEL"] }).model).toBe("gpt-4o")
  })

  it("never sends effort none to gpt-6.2-sol and ignores invalid efforts", () => {
    process.env.OPENAI_MODEL_FAST = "gpt-6.2-sol"
    expect(selectModel("FAST").reasoningEffort).toBe("low")
    process.env.OPENAI_MODEL_FAST = "gpt-6-luna"
    process.env.OPENAI_REASONING_EFFORT_FAST = "turbo"
    expect(selectModel("FAST").reasoningEffort).toBe("none")
  })

  it("selectionForModel resolves effort for an explicit id", () => {
    expect(selectionForModel("FAST", "gpt-4o-mini")).toEqual({ tier: "FAST", model: "gpt-4o-mini" })
    expect(selectionForModel("WRITER", "gpt-6.1-terra")).toEqual({ tier: "WRITER", model: "gpt-6.1-terra", reasoningEffort: "none" })
  })
})
