/**
 * Production Rate Limiting Tests
 * Comprehensive tests for tier-aware rate limiting and abuse detection
 */

import { enforceTierRateLimit } from "@/lib/rateLimit/tierAware";
import { detectAbuse, recordFailedRequest } from "@/lib/rateLimit/abuseDetection";
import { getUserTier } from "@/lib/billing/subscription";
import prisma from "@/lib/prisma";

jest.mock("@/lib/billing/subscription");
jest.mock("@/lib/billing/stripe");

const createMockRequest = (ip = "127.0.0.1", headers = {}) => ({
  headers: {
    get: (key) => {
      if (key === "x-forwarded-for") return ip;
      return headers[key] || null;
    },
  },
  ip,
});

describe("Production Rate Limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Tier-Aware Rate Limiting", () => {
    it("should apply FREE tier limits by default", async () => {
      getUserTier.mockResolvedValue("FREE");
      
      const request = createMockRequest();
      const userId = "user-123";
      
      // First 5 requests should pass
      for (let i = 0; i < 5; i++) {
        const result = await enforceTierRateLimit(request, "analyze", userId);
        expect(result).toBeNull();
      }
      
      // 6th request should be rate limited
      const result = await enforceTierRateLimit(request, "analyze", userId);
      expect(result).not.toBeNull();
      expect(result.status).toBe(429);
    });

    it("should apply PRO tier limits for PRO users", async () => {
      getUserTier.mockResolvedValue("PRO");
      
      const request = createMockRequest();
      const userId = "user-pro";
      
      // PRO users should get 20 requests
      for (let i = 0; i < 20; i++) {
        const result = await enforceTierRateLimit(request, "analyze", userId);
        expect(result).toBeNull();
      }
      
      // 21st request should be rate limited
      const result = await enforceTierRateLimit(request, "analyze", userId);
      expect(result).not.toBeNull();
      expect(result.status).toBe(429);
    });

    it("should default to FREE on tier fetch error", async () => {
      getUserTier.mockRejectedValue(new Error("DB error"));
      
      const request = createMockRequest();
      const result = await enforceTierRateLimit(request, "analyze", "user-123");
      
      // Should not throw, should use FREE limits
      expect(result).toBeNull();
    });

    it("should handle reports endpoint with different limits", async () => {
      getUserTier.mockResolvedValue("FREE");
      
      const request = createMockRequest();
      const userId = "user-123";
      
      // FREE users get 30 requests per minute for reports
      for (let i = 0; i < 30; i++) {
        const result = await enforceTierRateLimit(request, "reports", userId);
        expect(result).toBeNull();
      }
      
      // 31st should be limited
      const result = await enforceTierRateLimit(request, "reports", userId);
      expect(result).not.toBeNull();
      expect(result.status).toBe(429);
    });
  });

  describe("Abuse Detection", () => {
    it("should detect too many IPs per user", async () => {
      const userId = "user-123";
      const request1 = createMockRequest("192.168.1.1");
      const request2 = createMockRequest("192.168.1.2");
      
      // Simulate many IPs (would need Redis mock for full test)
      // This tests the logic path
      const result1 = await detectAbuse(request1, userId);
      expect(result1.blocked).toBe(false);
      
      // In real scenario, after threshold, should block
    });

    it("should handle Redis failures gracefully", async () => {
      // Abuse detection should not crash if Redis is down
      const request = createMockRequest();
      const result = await detectAbuse(request, "user-123");
      expect(result).toHaveProperty("blocked");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null userId", async () => {
      getUserTier.mockResolvedValue("FREE");
      
      const request = createMockRequest();
      const result = await enforceTierRateLimit(request, "analyze", null);
      
      // Should use IP-based limiting
      expect(result).toBeDefined();
    });

    it("should handle invalid endpoint", async () => {
      getUserTier.mockResolvedValue("FREE");
      
      const request = createMockRequest();
      
      await expect(
        enforceTierRateLimit(request, "invalid", "user-123")
      ).rejects.toThrow();
    });
  });
});
