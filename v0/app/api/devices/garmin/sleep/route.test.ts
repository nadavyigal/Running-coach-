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

  it("chunks multi-day requests into <= 86400-second upload windows and deduplicates sleep summaries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ permissions: ["HEALTH_EXPORT", "HISTORICAL_DATA_EXPORT"] }),
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
    expect(body.source).toBe("sleep-upload");
    expect(Array.isArray(body.sleep)).toBe(true);
    expect(body.sleep).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const windows = fetchMock.mock.calls.slice(1).map(([url]) => {
      const parsed = new URL(String(url));
      const start = Number(parsed.searchParams.get("uploadStartTimeInSeconds"));
      const end = Number(parsed.searchParams.get("uploadEndTimeInSeconds"));
      return { start, end };
    });

    expect(windows[0].end - windows[0].start).toBeLessThanOrEqual(86399);
    expect(windows[1].end - windows[1].start).toBeLessThanOrEqual(86399);
    expect(windows[1].start).toBe(windows[0].end + 1);
  });

  it("retries via backfill summary params when upload mode returns InvalidPullTokenException", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ permissions: ["HEALTH_EXPORT", "HISTORICAL_DATA_EXPORT"] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errorMessage: "InvalidPullTokenException failure" }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              sleepSummaryId: "sb1",
              calendarDate: "2026-02-17",
              startTimeInSeconds: 1771363200,
              durationInSeconds: 28000,
            },
          ]),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/sleep?userId=42&days=1",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe("sleep-backfill");
    expect(body.sleep).toHaveLength(1);
  });

  it("returns explicit HEALTH_EXPORT guidance when health permission is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ permissions: ["ACTIVITY_EXPORT"] }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/sleep?userId=42&days=1",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.requiredPermissions).toEqual(["HEALTH_EXPORT"]);
    expect(body.needsReauth).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns provisioning guidance when sleep endpoints are not enabled", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ permissions: ["HEALTH_EXPORT", "HISTORICAL_DATA_EXPORT"] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            timestamp: 1771441495662,
            status: 404,
            error: "Not Found",
            path: "/wellness-api/rest/sleeps",
          }),
          { status: 404 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            timestamp: 1771441495691,
            status: 404,
            error: "Not Found",
            path: "/wellness-api/rest/backfill/sleeps",
          }),
          { status: 404 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/sleep?userId=42&days=1",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.requiredPermissions).toEqual(["HEALTH_EXPORT", "HISTORICAL_DATA_EXPORT"]);
    expect(body.needsReauth).toBeUndefined();
  });

  it("defaults to a 30-day window when days is omitted", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url));

      if (parsed.pathname.endsWith("/wellness-api/rest/user/permissions")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ permissions: ["HEALTH_EXPORT", "HISTORICAL_DATA_EXPORT"] }),
            { status: 200 }
          )
        );
      }

      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/devices/garmin/sleep?userId=42", {
      headers: { authorization: "Bearer test-token" },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // 1 permissions call + 30 one-day sleep windows
    expect(fetchMock).toHaveBeenCalledTimes(31);

    const firstWindowUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    const lastWindowUrl = new URL(String(fetchMock.mock.calls[30]?.[0]));
    const expectedEnd = Math.floor(new Date("2026-02-18T12:00:00.000Z").getTime() / 1000);
    const expectedStart = expectedEnd - 30 * 86400 + 1;

    expect(Number(firstWindowUrl.searchParams.get("uploadStartTimeInSeconds"))).toBe(expectedStart);
    expect(Number(lastWindowUrl.searchParams.get("uploadEndTimeInSeconds"))).toBe(expectedEnd);
  });
});
