/**
 * Redis Client Singleton
 * Lazy-connect: client is created on first use, not at module load time.
 * This prevents build-time connection attempts when Redis URL is not available.
 */

import Redis from "ioredis";
import { env } from "./env.js";

let redisClient = null;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: true,
    });

    redisClient.on("error", (error) => {
      if (process.env.NODE_ENV !== "test") {
        console.error("[redis] Connection error:", error.message);
      }
    });
  }
  return redisClient;
}

// Lazy default export — does NOT connect at import time
export default {
  get client() {
    return getRedisClient();
  },
  get(key) { return getRedisClient().get(key); },
  set(key, value) { return getRedisClient().set(key, value); },
  setex(key, ttl, value) { return getRedisClient().setex(key, ttl, value); },
  del(key) { return getRedisClient().del(key); },
  ping() { return getRedisClient().ping(); },
  mget(...keys) { return getRedisClient().mget(...keys); },
  disconnect() { return redisClient?.disconnect(); },
};
