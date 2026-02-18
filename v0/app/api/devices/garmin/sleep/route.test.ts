import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("/api/devices/garmin/sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chunks multi-day requests into <= 86400-second windows and deduplicates sleep summaries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              sleepSummaryId: "s1",
              calendarDate: "2026-02-16",
              startTimeInSeconds: 1771200000,
              durationInSeconds: 27000,
              deepSleepDurationInSeconds: 5000,
            },
          ]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              sleepSummaryId: "s1",
              calendarDate: "2026-02-16",
              startTimeInSeconds: 1771200000,
              durationInSeconds: 27000,
            },
            {
              sleepSummaryId: "s2",
              calendarDate: "2026-02-17",
              startTimeInSeconds: 1771286400,
              durationInSeconds: 28000,
              remSleepInSeconds: 6000,
            },
          ]),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/sleep?userId=42&days=2",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.sleep)).toBe(true);
    expect(body.sleep).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const windows = fetchMock.mock.calls.map(([url]) => {
      const parsed = new URL(String(url));
      const start = Number(parsed.searchParams.get("startTimeInSeconds"));
      const end = Number(parsed.searchParams.get("endTimeInSeconds"));
      return { start, end };
    });

    expect(windows[0].end - windows[0].start).toBeLessThanOrEqual(86399);
    expect(windows[1].end - windows[1].start).toBeLessThanOrEqual(86399);
    expect(windows[1].start).toBe(windows[0].end + 1);
  });
});
