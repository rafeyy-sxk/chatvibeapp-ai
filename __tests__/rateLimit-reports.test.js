/**
 * Rate Limiting Tests for /api/reports
 */

import { GET as getReports } from "@/app/api/reports/route";
import { GET as getReportById } from "@/app/api/reports/[id]/route";
import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { enforceRateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/prisma";

jest.mock("@/lib/auth/tokens");
jest.mock("@/lib/rateLimit");

describe("Rate Limiting - /api/reports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    verifyAccessToken.mockReturnValue({
      sub: "user-123",
      username: "testuser",
    });

    // Default: rate limit allows request
    enforceRateLimit.mockResolvedValue(null);

    prisma.analysisReport.findMany.mockResolvedValue([
      {
        id: "r1",
        createdAt: new Date(),
        analyticsJson: {},
        geminiSummary: {},
      },
    ]);

    prisma.analysisReport.findFirst.mockResolvedValue({
      id: "r1",
      createdAt: new Date(),
      rawText: "test",
      ocrTranscript: "test",
      analyticsJson: {},
      geminiSummary: {},
    });
  });

  const createRequest = (url, headers = {}) => {
    return new NextRequest(url, {
      method: "GET",
      headers: {
        authorization: "Bearer test-token",
        ...headers,
      },
    });
  };

  describe("GET /api/reports", () => {
    it("should enforce rate limit before processing", async () => {
      const rateLimitResponse = {
        json: jest.fn(async () => ({ error: "Too many requests. Please slow down." })),
        status: 429,
        headers: new Map([["Retry-After", "60"]]),
      };
      
      enforceRateLimit.mockResolvedValue(rateLimitResponse);

      const request = createRequest("http://localhost:3000/api/reports");
      const response = await getReports(request);
      const data = await response.json();

      expect(enforceRateLimit).toHaveBeenCalledWith(request, {
        limit: 30,
        windowSeconds: 60,
        keyPrefix: "reports",
        userId: "user-123",
      });
      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many requests");
    });

    it("should not query database when rate limited", async () => {
      const rateLimitResponse = {
        json: jest.fn(async () => ({ error: "Too many requests. Please slow down." })),
        status: 429,
        headers: new Map(),
      };
      
      enforceRateLimit.mockResolvedValue(rateLimitResponse);

      const request = createRequest("http://localhost:3000/api/reports");
      await getReports(request);

      expect(prisma.analysisReport.findMany).not.toHaveBeenCalled();
    });

    it("should allow requests under rate limit", async () => {
      enforceRateLimit.mockResolvedValue(null);

      const request = createRequest("http://localhost:3000/api/reports");
      const response = await getReports(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reports).toBeDefined();
      expect(enforceRateLimit).toHaveBeenCalled();
    });
  });

  describe("GET /api/reports/[id]", () => {
    it("should enforce rate limit before processing", async () => {
      const rateLimitResponse = {
        json: jest.fn(async () => ({ error: "Too many requests. Please slow down." })),
        status: 429,
        headers: new Map(),
      };
      
      enforceRateLimit.mockResolvedValue(rateLimitResponse);

      const request = createRequest("http://localhost:3000/api/reports/r1");
      const response = await getReportById(request, { params: { id: "r1" } });
      const data = await response.json();

      expect(enforceRateLimit).toHaveBeenCalledWith(request, {
        limit: 30,
        windowSeconds: 60,
        keyPrefix: "reports",
        userId: "user-123",
      });
      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many requests");
    });

    it("should use userId for authenticated requests", async () => {
      verifyAccessToken.mockReturnValue({
        sub: "user-789",
        username: "differentuser",
      });

      const request = createRequest("http://localhost:3000/api/reports/r1");
      await getReportById(request, { params: { id: "r1" } });

      expect(enforceRateLimit).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          userId: "user-789",
        })
      );
    });
  });
});
