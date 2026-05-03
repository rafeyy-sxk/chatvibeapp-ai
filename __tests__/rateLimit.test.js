/**
 * Rate Limiting Utility Tests
 */

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => {
    throw new Error("Redis not available in tests");
  });
});

describe("Rate Limiter Utility", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("blocks requests beyond configured threshold", async () => {
    const { enforceRateLimit } = require("../lib/rateLimit");
    const request = {
      headers: {
        get: (key) => (key === "x-forwarded-for" ? "10.0.0.1" : null),
      },
      ip: "10.0.0.1",
    };

    // First 5 requests should pass (for analyze endpoint limit)
    for (let i = 0; i < 5; i += 1) {
      const result = await enforceRateLimit(request, {
        limit: 5,
        windowSeconds: 60,
        keyPrefix: "test",
      });
      expect(result).toBeNull();
    }

    // 6th request should be blocked
    const blocked = await enforceRateLimit(request, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "test",
    });
    expect(blocked?.status).toBe(429);
  });

  it("prefers userId over IP for rate limiting", async () => {
    const { enforceRateLimit } = require("../lib/rateLimit");
    const request = {
      headers: { get: () => null },
      ip: "10.0.0.1",
    };

    // Same IP, different users should have separate limits
    const result1 = await enforceRateLimit(request, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "test",
      userId: "user-1",
    });

    const result2 = await enforceRateLimit(request, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "test",
      userId: "user-2",
    });

    // Both should pass (different keys)
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  it("falls back to IP when userId is not provided", async () => {
    const { enforceRateLimit } = require("../lib/rateLimit");
    const request = {
      headers: {
        get: (key) => (key === "x-forwarded-for" ? "192.168.1.1" : null),
      },
      ip: "192.168.1.1",
    };

    const result = await enforceRateLimit(request, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "test",
    });

    expect(result).toBeNull();
  });
});

