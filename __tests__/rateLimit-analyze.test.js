/**
 * Rate Limiting Tests for /api/analyze
 */

import { POST } from "@/app/api/analyze/route";
import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import prisma from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rateLimit";

jest.mock("@/lib/auth/tokens");
jest.mock("@/lib/rateLimit");
jest.mock("@/lib/queue");

const SAMPLE_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/xcAAusB9Yp0n6cAAAAASUVORK5CYII=";

describe("Rate Limiting - /api/analyze", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-api-key";
    
    verifyAccessToken.mockReturnValue({
      sub: "user-123",
      username: "testuser",
    });

    // Default: rate limit allows request
    enforceRateLimit.mockResolvedValue(null);
  });

  const createRequest = (body, headers = {}) => {
    return new NextRequest("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer test-token",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  it("should enforce rate limit before processing", async () => {
    const rateLimitResponse = {
      json: jest.fn(async () => ({ error: "Too many requests. Please slow down." })),
      status: 429,
      headers: new Map([["Retry-After", "60"]]),
    };
    
    enforceRateLimit.mockResolvedValue(rateLimitResponse);

    const request = createRequest({
      images: [SAMPLE_IMAGE],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(enforceRateLimit).toHaveBeenCalledWith(request, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "analyze",
      userId: "user-123",
    });
    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("should not process request when rate limited", async () => {
    const rateLimitResponse = {
      json: jest.fn(async () => ({ error: "Too many requests. Please slow down." })),
      status: 429,
      headers: new Map(),
    };
    
    enforceRateLimit.mockResolvedValue(rateLimitResponse);

    const request = createRequest({
      images: [SAMPLE_IMAGE],
    });

    await POST(request);

    // Should not reach queue or processing
    expect(prisma.analysisJob.create).not.toHaveBeenCalled();
  });

  it("should use userId for rate limiting when authenticated", async () => {
    verifyAccessToken.mockReturnValue({
      sub: "user-456",
      username: "anotheruser",
    });

    const request = createRequest({
      images: [SAMPLE_IMAGE],
    });

    await POST(request);

    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        userId: "user-456",
      })
    );
  });

  it("should allow requests under rate limit", async () => {
    enforceRateLimit.mockResolvedValue(null);
    
    // Mock queue to be available
    const { analysisQueue, addAnalysisJob } = await import("@/lib/queue");
    analysisQueue.getWaitingCount.mockResolvedValue(0);
    addAnalysisJob.mockResolvedValue({ id: "job-123" });
    prisma.analysisJob.create.mockResolvedValue({
      id: "job-123",
      userId: "user-123",
      status: "PENDING",
      progress: 0,
      imageCount: 1,
    });

    const request = createRequest({
      images: [SAMPLE_IMAGE],
    });

    const response = await POST(request);
    
    expect(response.status).toBe(202);
    expect(enforceRateLimit).toHaveBeenCalled();
  });

  it("should handle rate limit for unauthenticated requests (IP fallback)", async () => {
    verifyAccessToken.mockReturnValue(null);
    
    const rateLimitResponse = {
      json: jest.fn(async () => ({ error: "Too many requests. Please slow down." })),
      status: 429,
      headers: new Map(),
    };
    enforceRateLimit.mockResolvedValue(rateLimitResponse);

    const request = createRequest({
      images: [SAMPLE_IMAGE],
    });

    const response = await POST(request);

    expect(enforceRateLimit).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        userId: undefined, // Should use IP fallback
      })
    );
    expect(response.status).toBe(429);
  });
});
