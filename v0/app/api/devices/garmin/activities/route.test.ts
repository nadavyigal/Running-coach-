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

  it("chunks multi-day requests into <= 86400-second upload windows and deduplicates activities", async () => {
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
    expect(body.source).toBe("wellness-upload");
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

  it("retries via backfill summary params when upload mode returns InvalidPullTokenException", async () => {
    const fetchMock = vi
      .fn()
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
              activityId: "b1",
              activityType: "running",
              startTimeInSeconds: 1771408800,
              durationInSeconds: 1800,
              distanceInMeters: 5000,
            },
          ]),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/activities?userId=42&days=1",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe("wellness-backfill");
    expect(body.runningCount).toBe(1);
    expect(body.activities[0].activityId).toBe("b1");

    const firstUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const secondUrl = String(fetchMock.mock.calls[1]?.[0] ?? "");
    expect(firstUrl).toContain("/wellness-api/rest/activities");
    expect(firstUrl).toContain("uploadStartTimeInSeconds");
    expect(secondUrl).toContain("/wellness-api/rest/backfill/activities");
    expect(secondUrl).toContain("summaryStartTimeInSeconds");
    expect(secondUrl).toContain("summaryEndTimeInSeconds");
  });

  it("retries via backfill summary params when upload mode returns 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              activityId: "b404",
              activityType: "running",
              startTimeInSeconds: 1771408800,
              durationInSeconds: 1800,
              distanceInMeters: 5000,
            },
          ]),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/activities?userId=42&days=1",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe("wellness-backfill");
    expect(body.runningCount).toBe(1);
  });

  it("does not force reauth on generic 403 Forbidden without token-expired markers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: "HTTP 403 Forbidden", error: "ForbiddenException" }),
          { status: 403 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/activities?userId=42&days=1",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.needsReauth).toBeUndefined();
    expect(body.source).toBe("wellness-backfill");
  });

  it("returns explicit ACTIVITY_EXPORT permission guidance when CONNECT_ACTIVITY summary is not enabled", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errorMessage:
              "[abc]Endpoint not enabled for summary type: CONNECT_ACTIVITY",
          }),
          { status: 400 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const req = new Request(
      "http://localhost/api/devices/garmin/activities?userId=42&days=1",
      {
        headers: { authorization: "Bearer test-token" },
      }
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.requiredPermissions).toEqual(["ACTIVITY_EXPORT"]);
    expect(body.needsReauth).toBeUndefined();
  });
});
