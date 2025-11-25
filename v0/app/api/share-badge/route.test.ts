import { POST } from "@/app/api/share-badge/route";
import { NextResponse } from "next/server";

describe("POST /api/share-badge", () => {
  it("should return a shareable link for a given badgeId", async () => {
    const mockRequest = {
      json: async () => ({ badgeId: "badge123", userId: "user456" }),
    } as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("shareableLink");
    expect(data.shareableLink).toContain("https://runsmart.com/share/badge/badge123");
  });

  it("should return a 500 error if an exception occurs", async () => {
    const mockRequest = {
      json: async () => {
        throw new Error("Test error");
      },
    } as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty("message", "Error generating shareable link");
  });
});
