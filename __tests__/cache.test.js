/**
 * Cache System Tests
 */

import { cache, cacheRedis, cacheMemory } from "../lib/cache";
import { getCachedAnalysisResult, setCachedAnalysisResult } from "../lib/cache/analysisCache";

jest.mock("../lib/redis", () => ({
  default: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock("../lib/logger", () => ({
  log: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Cache System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("cacheRedis", () => {
    it("should get value from Redis", async () => {
      const redis = require("../lib/redis").default;
      redis.get.mockResolvedValue('{"data": "test"}');

      const result = await cacheRedis.get("test-key");
      expect(result).toBe('{"data": "test"}');
    });

    it("should set value in Redis with TTL", async () => {
      const redis = require("../lib/redis").default;
      redis.setex.mockResolvedValue("OK");

      await cacheRedis.setex("test-key", 3600, "test-value");
      expect(redis.setex).toHaveBeenCalledWith("test-key", 3600, "test-value");
    });

    it("should delete value from Redis", async () => {
      const redis = require("../lib/redis").default;
      redis.del.mockResolvedValue(1);

      await cacheRedis.del("test-key");
      expect(redis.del).toHaveBeenCalledWith("test-key");
    });
  });

  describe("analysisCache", () => {
    it("should get cached analysis result", async () => {
      const redis = require("../lib/redis").default;
      redis.get.mockResolvedValue(JSON.stringify({ id: "report123", data: "test" }));

      const result = await getCachedAnalysisResult("report123");
      expect(result).toEqual({ id: "report123", data: "test" });
    });

    it("should return null if cache miss", async () => {
      const redis = require("../lib/redis").default;
      redis.get.mockResolvedValue(null);

      const result = await getCachedAnalysisResult("report123");
      expect(result).toBeNull();
    });

    it("should set cached analysis result", async () => {
      const redis = require("../lib/redis").default;
      redis.setex.mockResolvedValue("OK");

      const report = { id: "report123", data: "test" };
      await setCachedAnalysisResult("report123", report, 86400);

      expect(redis.setex).toHaveBeenCalledWith(
        "analysis:report123",
        86400,
        JSON.stringify(report)
      );
    });
  });
});



























