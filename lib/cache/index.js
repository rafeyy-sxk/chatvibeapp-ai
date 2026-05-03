/**
 * Multi-Level Caching System
 * L1: In-memory (request deduplication)
 * L2: Redis (LRU cache for OCR results)
 * L3: Redis (Analysis results cache)
 */

import { createHash } from "crypto";
import { env } from "../env.js";
import { log } from "../logger/index.js";
import { getRedisClient } from "../redis.js";

// Lazy Redis accessor — no connection at import time
const redis = {
  get: (key) => getRedisClient().get(key),
  setex: (key, ttl, value) => getRedisClient().setex(key, ttl, value),
  del: (...keys) => getRedisClient().del(...keys),
  keys: (pattern) => getRedisClient().keys(pattern),
};

// L1: In-memory cache (request-level deduplication)
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 60000; // 1 minute

// Generate cache key from content
function generateCacheKey(prefix, content) {
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return `${prefix}:${hash}`;
}

// L1: Memory cache
export const memoryCacheLayer = {
  get: (key) => {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    
    return entry.value;
  },
  
  set: (key, value, ttl = MEMORY_CACHE_TTL) => {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    
    // Cleanup expired entries periodically
    if (memoryCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of memoryCache.entries()) {
        if (now > v.expiresAt) {
          memoryCache.delete(k);
        }
      }
    }
  },
  
  delete: (key) => {
    memoryCache.delete(key);
  },
  
  clear: () => {
    memoryCache.clear();
  },
};

// L2/L3: Redis cache
export const redisCacheLayer = {
  get: async (key) => {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      
      const parsed = JSON.parse(value);
      log.debug("Cache hit", { key, layer: "redis" });
      return parsed;
    } catch (error) {
      log.warn("Cache get error", { key, error: error.message });
      return null;
    }
  },
  
  set: async (key, value, ttl = 3600) => {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      log.debug("Cache set", { key, ttl, layer: "redis" });
    } catch (error) {
      log.warn("Cache set error", { key, error: error.message });
    }
  },
  
  delete: async (key) => {
    try {
      await redis.del(key);
    } catch (error) {
      log.warn("Cache delete error", { key, error: error.message });
    }
  },
  
  clear: async (pattern = "*") => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      log.warn("Cache clear error", { pattern, error: error.message });
    }
  },
};

// L3: Database cache for analysis results (fallback when Redis is down)
const dbCacheLayer = {
  get: async (key) => {
    try {
      const prisma = (await import("../prisma")).default;
      const cached = await prisma.cacheEntry.findUnique({
        where: { key },
      });
      
      if (!cached || new Date() > cached.expiresAt) {
        if (cached) {
          await prisma.cacheEntry.delete({ where: { key } });
        }
        return null;
      }
      
      return JSON.parse(cached.value);
    } catch (error) {
      log.error("Database cache read error", { error: error.message, key });
      return null;
    }
  },
  
  set: async (key, value, ttl = 86400) => {
    try {
      const prisma = (await import("../prisma")).default;
      const expiresAt = new Date(Date.now() + ttl * 1000);
      
      await prisma.cacheEntry.upsert({
        where: { key },
        update: {
          value: JSON.stringify(value),
          expiresAt,
        },
        create: {
          key,
          value: JSON.stringify(value),
          expiresAt,
        },
      });
    } catch (error) {
      log.error("Database cache write error", { error: error.message, key });
    }
  },
  
  delete: async (key) => {
    try {
      const prisma = (await import("../prisma")).default;
      await prisma.cacheEntry.delete({ where: { key } });
    } catch (error) {
      log.error("Database cache delete error", { error: error.message, key });
    }
  },
};

// Multi-level cache get (L1 -> L2/L3)
export async function getCached(prefix, content, layer = "redis") {
  const key = generateCacheKey(prefix, content);
  
  // Try L1 first
  const l1Value = memoryCacheLayer.get(key);
  if (l1Value !== null) {
    log.debug("Cache hit", { key, layer: "memory" });
    return l1Value;
  }
  
  // Try Redis
  if (layer === "redis") {
    const redisValue = await redisCacheLayer.get(key);
    if (redisValue !== null) {
      // Populate L1
      memoryCacheLayer.set(key, redisValue, 60000);
      return redisValue;
    }
  }
  
  log.debug("Cache miss", { key, layer });
  return null;
}

// Multi-level cache set
export async function setCached(prefix, content, value, ttl = 3600, layer = "redis") {
  const key = generateCacheKey(prefix, content);
  
  // Set in L1
  memoryCacheLayer.set(key, value, Math.min(ttl * 1000, 60000));
  
  // Set in Redis if specified
  if (layer === "redis") {
    await redisCacheLayer.set(key, value, ttl);
    
    // Also cache analysis results in database for persistence
    if (prefix === "analysis" && ttl > 3600) {
      await dbCacheLayer.set(key, value, ttl);
    }
  }
}

// Cache invalidation
export async function invalidateCache(prefix, content) {
  const key = generateCacheKey(prefix, content);
  memoryCacheLayer.delete(key);
  await redisCacheLayer.delete(key);
}

// OCR result cache
export async function getCachedOCR(imageBase64) {
  return getCached("ocr", imageBase64, "redis");
}

export async function setCachedOCR(imageBase64, result, ttl = 3600) {
  return setCached("ocr", imageBase64, result, ttl, "redis");
}

// Analysis result cache
export async function getCachedAnalysis(text) {
  return getCached("analysis", text, "redis");
}

export async function setCachedAnalysis(text, result, ttl = 86400) {
  return setCached("analysis", text, result, ttl, "redis");
}

export { redis as cacheRedis };

