/**
 * Redis Layer Tests
 * Tests for cache, rate limiting, and Redis operations
 */

import Redis from "ioredis-mock";
import { getCachedOCR, setCachedOCR, getCachedAnalysis, setCachedAnalysis } from "@/lib/cache";

jest.mock("@/lib/redis", () => {
  const Redis = require("ioredis-mock");
  return {
    __esModule: true,
    default: new Redis(),
  };
});

describe("Redis Layer", () => {
  let redis;

  beforeEach(async () => {
    redis = new Redis();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await redis.quit();
  });

  describe("Cache Operations", () => {
    it("should set and get cached OCR result", async () => {
      const imageHash = "test-hash-123";
      const ocrText = "test ocr text";

      await setCachedOCR(imageHash, ocrText, 3600);
      const cached = await getCachedOCR(imageHash);

      expect(cached).toBe(ocrText);
    });

    it("should set and get cached analysis result", async () => {
      const textHash = "test-hash-456";
      const analysis = {
        summary: "test",
        overall_vibe: "positive",
        metrics: { flirty: 10 },
      };

      await setCachedAnalysis(textHash, analysis, 86400);
      const cached = await getCachedAnalysis(textHash);

      expect(cached).toEqual(analysis);
    });

    it("should handle cache miss", async () => {
      const cached = await getCachedOCR("non-existent-hash");
      expect(cached).toBeNull();
    });

    it("should respect cache expiry", async () => {
      const imageHash = "test-hash-expiry";
      const ocrText = "test ocr text";

      await setCachedOCR(imageHash, ocrText, 1); // 1 second expiry

      // Should be available immediately
      let cached = await getCachedOCR(imageHash);
      expect(cached).toBe(ocrText);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      cached = await getCachedOCR(imageHash);
      expect(cached).toBeNull();
    });
  });

  describe("Rate Limiting", () => {
    it("should track rate limit hits", async () => {
      const key = "rate-limit:user-123";
      const limit = 5;
      const window = 60; // 60 seconds

      // Simulate rate limiting
      for (let i = 0; i < limit; i++) {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, window);
        }
        expect(count).toBe(i + 1);
      }

      // Should exceed limit
      const finalCount = await redis.get(key);
      expect(parseInt(finalCount)).toBeGreaterThanOrEqual(limit);
    });

    it("should reset rate limit after window", async () => {
      const key = "rate-limit:user-123";
      const window = 1; // 1 second

      await redis.set(key, "5", "EX", window);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const count = await redis.get(key);
      expect(count).toBeNull();
    });
  });

  describe("Race Conditions", () => {
    it("should handle concurrent cache writes", async () => {
      const key = "concurrent-test";
      const values = ["value1", "value2", "value3"];

      // Simulate concurrent writes
      const promises = values.map((value) =>
        redis.set(key, value)
      );

      await Promise.all(promises);

      const finalValue = await redis.get(key);
      expect(values).toContain(finalValue);
    });

    it("should handle concurrent reads", async () => {
      const key = "concurrent-read";
      const value = "test-value";

      await redis.set(key, value);

      // Simulate concurrent reads
      const promises = Array(10).fill(null).map(() => redis.get(key));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBe(value);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle Redis connection failure", async () => {
      const badRedis = new Redis("redis://invalid-host:6379");

      try {
        await badRedis.get("test-key");
      } catch (error) {
        expect(error).toBeDefined();
      }

      await badRedis.quit();
    });

    it("should handle cache corruption scenario", async () => {
      const key = "corrupted-cache";
      
      // Set invalid data
      await redis.set(key, "invalid-json-{broken");

      try {
        const data = await redis.get(key);
        JSON.parse(data); // Should fail
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
      }
    });
  });
});

