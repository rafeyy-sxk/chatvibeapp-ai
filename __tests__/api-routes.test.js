/**
 * API Routes Tests
 * Tests for critical API endpoints
 */

import { NextRequest } from "next/server";
import prisma from "../lib/prisma";
import { verifyAccessToken, generateAccessToken } from "../lib/auth/tokens";

jest.mock("../lib/prisma");
jest.mock("../lib/auth/tokens");
jest.mock("../lib/logger", () => ({
  getCorrelationId: jest.fn(() => "test-correlation-id"),
  log: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock API routes
describe("API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Health Endpoint", () => {
    it("should return healthy status", async () => {
      const { GET } = await import("../app/api/health/route");
      const request = new NextRequest("http://localhost:3000/api/health");

      prisma.$queryRaw.mockResolvedValue([{ now: new Date() }]);
      const redis = require("../lib/redis").default;
      redis.ping = jest.fn().mockResolvedValue("PONG");

      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe("healthy");
    });
  });

  describe("Reports API", () => {
    it("should return user reports", async () => {
      const { GET } = await import("../app/api/reports/route");
      const token = generateAccessToken({ sub: "user123" });
      verifyAccessToken.mockReturnValue({ sub: "user123" });

      const request = new NextRequest("http://localhost:3000/api/reports", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      prisma.analysisReport.findMany.mockResolvedValue([
        {
          id: "report123",
          createdAt: new Date(),
          analyticsJson: {},
          geminiSummary: {},
        },
      ]);

      const response = await GET(request);
      const data = await response.json();

      expect(data.reports).toBeDefined();
      expect(prisma.analysisReport.findMany).toHaveBeenCalled();
    });

    it("should return 403 for unauthorized requests", async () => {
      const { GET } = await import("../app/api/reports/route");
      const request = new NextRequest("http://localhost:3000/api/reports");

      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });
});



























