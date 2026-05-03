/**
 * Concurrency Control
 * 
 * Limits concurrent operations to prevent server overload
 */

import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { getRedisClient } from '../redis';
import { env } from '../env';

let concurrencyLimiter;

try {
  const redis = getRedisClient();
  concurrencyLimiter = new RateLimiterRedis({
    storeClient: redis,
    points: 10, // Max 10 concurrent operations per user
    duration: 60, // Per minute
    keyPrefix: 'concurrency',
  });
} catch (error) {
  console.warn('[concurrency] Falling back to in-memory limiter:', error.message);
  concurrencyLimiter = new RateLimiterMemory({
    points: 10,
    duration: 60,
  });
}

/**
 * Check if user can perform operation (concurrency limit)
 * @param {string} userId - User ID
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: Date}>}
 */
export async function checkConcurrency(userId) {
  try {
    const rateLimiterRes = await concurrencyLimiter.consume(userId);
    return {
      allowed: true,
      remaining: rateLimiterRes.remainingPoints,
      resetTime: new Date(Date.now() + rateLimiterRes.msBeforeNext),
    };
  } catch (rateLimiterRes) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(Date.now() + rateLimiterRes.msBeforeNext),
    };
  }
}

/**
 * Release concurrency slot
 * @param {string} userId - User ID
 */
export async function releaseConcurrency(userId) {
  try {
    await concurrencyLimiter.delete(userId);
  } catch (error) {
    console.error('[concurrency] Error releasing slot', error);
  }
}

