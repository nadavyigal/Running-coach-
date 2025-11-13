import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import { NextResponse } from "next/server";
import * as dbUtilsModule from '../../../lib/dbUtils';

describe("POST /api/share-run", () => {
  it("should return a shareable link for a given runId", async () => {
    // Mock dbUtils.getRunsByUser to return a fake run
    const fakeRun = {
      id: 123,
      userId: 456,
      type: 'easy' as const,
      distance: 5,
      duration: 1800,
      completedAt: new Date(),
      createdAt: new Date(),
    };
    const spy = vi.spyOn(dbUtilsModule.dbUtils, 'getRunsByUser').mockResolvedValue([fakeRun]);

    const mockRequest = {
      json: async () => ({ runId: "123", userId: "456" }),
    } as unknown as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("shareableLink");
    expect(data.shareableLink).toContain("https://runsmart.com/share/run/123");

    spy.mockRestore();
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