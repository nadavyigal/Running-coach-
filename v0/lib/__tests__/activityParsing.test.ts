import { describe, it, expect } from "vitest"
import {
  parseLocaleNumber,
  parseDurationStringToSeconds,
  parsePaceToSecondsPerKm,
  parseActivityFromText,
} from "../activityParsing"

describe("activityParsing", () => {
  it("parses locale numbers", () => {
    expect(parseLocaleNumber("1,23")).toBeCloseTo(1.23)
    expect(parseLocaleNumber("1.234,56")).toBeCloseTo(1234.56)
    expect(parseLocaleNumber("1,234.56")).toBeCloseTo(1234.56)
    expect(parseLocaleNumber("  5.0 km ")).toBeCloseTo(5.0)
  })

  it("parses durations", () => {
    expect(parseDurationStringToSeconds("25:30")).toBe(1530)
    expect(parseDurationStringToSeconds("1:25:30")).toBe(5130)
    expect(parseDurationStringToSeconds("90")).toBe(90)
  })

  it("parses pace", () => {
    expect(parsePaceToSecondsPerKm("5:30")).toBe(330)
    expect(parsePaceToSecondsPerKm("4’35”/km")).toBe(275)
    expect(parsePaceToSecondsPerKm(5.5)).toBe(330)
    expect(parsePaceToSecondsPerKm(330)).toBe(330)
  })

  it("extracts activity fields from text", () => {
    const text = `
Activity
Distance 5,01 km
Time 25:30
Avg Pace 5:05 /km
Calories 320 kcal
`.trim()

    const parsed = parseActivityFromText(text)
    expect(parsed.distanceKm).toBeCloseTo(5.01)
    expect(parsed.durationSeconds).toBe(1530)
    expect(parsed.paceSecondsPerKm).toBe(305)
    expect(parsed.calories).toBe(320)
  })
})

