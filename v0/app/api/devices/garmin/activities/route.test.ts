import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("/api/devices/garmin/activities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chunks multi-day requests into <= 86400-second windows and deduplicates activities", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              activityId: "a1",
              activityType: "running",
              startTimeInSeconds: 1708257600,
              durationInSeconds: 1800,
              distanceInMeters: 5000,
            },
          ]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              activityId: "a1",
              activityType: "running",
              startTimeInSeconds: 1708257600,
              durationInSeconds: 1800,
              distanceInMeters: 5000,
            },
            {
              activityId: "a2",
              activityType: "running",
              startTimeInSeconds: 1708344000,
              durationInSeconds: 2100,
              distanceInMeters: 6000,
            },
          ]),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/activities?userId=42&days=2",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.allActivities).toBe(2);
    expect(body.runningCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const windows = fetchMock.mock.calls.map(([url]) => {
      const parsed = new URL(String(url));
      const start = Number(parsed.searchParams.get("uploadStartTimeInSeconds"));
      const end = Number(parsed.searchParams.get("uploadEndTimeInSeconds"));
      return { start, end };
    });

    expect(windows[0].end - windows[0].start).toBeLessThanOrEqual(86399);
    expect(windows[1].end - windows[1].start).toBeLessThanOrEqual(86399);
    expect(windows[1].start).toBe(windows[0].end + 1);
  });
});
