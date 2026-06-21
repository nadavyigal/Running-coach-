import { beforeEach, describe, expect, it } from "vitest"
import {
  __resetVoiceCueThrottle,
  checkVoiceCueThrottle,
  MAX_PER_WINDOW,
  MIN_INTERVAL_MS,
  WINDOW_MS,
} from "./voice-cue-throttle"

describe("checkVoiceCueThrottle", () => {
  beforeEach(() => {
    __resetVoiceCueThrottle()
  })

  it("allows the first cue for a key", () => {
    const result = checkVoiceCueThrottle("user-1", 0)
    expect(result.allowed).toBe(true)
  })

  it("blocks a second cue inside the minimum interval", () => {
    checkVoiceCueThrottle("user-1", 0)
    const result = checkVoiceCueThrottle("user-1", MIN_INTERVAL_MS - 1)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe("min_interval")
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("allows a cue once the minimum interval has elapsed", () => {
    checkVoiceCueThrottle("user-1", 0)
    const result = checkVoiceCueThrottle("user-1", MIN_INTERVAL_MS)
    expect(result.allowed).toBe(true)
  })

  it("isolates throttling per key", () => {
    checkVoiceCueThrottle("user-1", 0)
    const other = checkVoiceCueThrottle("user-2", 0)
    expect(other.allowed).toBe(true)
  })

  it("enforces the hourly ceiling", () => {
    // Space hits MIN_INTERVAL_MS apart so only the hourly cap can trip.
    let t = 0
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      expect(checkVoiceCueThrottle("user-1", t).allowed).toBe(true)
      t += MIN_INTERVAL_MS
    }
    const blocked = checkVoiceCueThrottle("user-1", t)
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toBe("hourly_cap")
  })

  it("frees capacity after the rolling window passes", () => {
    let t = 0
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      checkVoiceCueThrottle("user-1", t)
      t += MIN_INTERVAL_MS
    }
    // Jump past the window relative to the oldest hit; it should drop out.
    const result = checkVoiceCueThrottle("user-1", WINDOW_MS + 1)
    expect(result.allowed).toBe(true)
  })
})
