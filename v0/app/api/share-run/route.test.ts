import { afterEach, describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import * as dbUtilsModule from '@/lib/dbUtils';

describe("POST /api/share-run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a shareable link for a given runId", async () => {
    // Mock dbUtils.getRunsByUser to return a fake run
    const fakeRun = {
      id: 123,
      userId: 456,
      type: 'easy' as const,
      distance: 5,
      duration: 1800,
      pace: 360,
      calories: 320,
      completedAt: new Date(),
      createdAt: new Date(),
    };
    vi.spyOn(dbUtilsModule.dbUtils, 'getRunsByUser').mockResolvedValue([fakeRun]);
    vi.spyOn(dbUtilsModule.dbUtils, 'getCurrentUser').mockResolvedValue({
      id: 456,
      name: 'Nadav',
    } as Awaited<ReturnType<typeof dbUtilsModule.dbUtils.getCurrentUser>>);

    const mockRequest = {
      json: async () => ({ runId: 123, userId: 456 }),
    } as unknown as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("shareableLink");
    expect(data.shareableLink).toContain("https://runsmart.com/share/run/123");
  });

  it("should return a 500 error if an exception occurs", async () => {
    const mockRequest = {
      json: async () => {
        throw new Error("Test error");
      },
    } as unknown as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty("message", "Error generating shareable link");
  });
});
