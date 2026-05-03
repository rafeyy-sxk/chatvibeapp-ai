/**
 * Rate Limiting — in-memory with Redis upgrade path.
 * Always uses RateLimiterMemory so the app works without Redis.
 * Redis errors previously caused every request to return 429 — fixed.
 */

import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextResponse } from "next/server";

// Cache limiters by config key
const limiterCache = new Map();

function getLimiter(limit, windowSeconds) {
  const key = `${limit}:${windowSeconds}`;
  if (!limiterCache.has(key)) {
    limiterCache.set(
      key,
      new RateLimiterMemory({ points: limit, duration: windowSeconds })
    );
  }
  return limiterCache.get(key);
}

function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : request.ip || "unknown";
}

export async function enforceRateLimit(request, options = {}) {
  const {
    limit = 60,
    windowSeconds = 60,
    keyPrefix = "global",
    userId,
  } = typeof options === "string"
    ? { keyPrefix: options }
    : options;

  const identifier = userId || getClientIp(request);
  const limiter = getLimiter(limit, windowSeconds);

  try {
    await limiter.consume(`${keyPrefix}:${identifier}`);
    return null; // allowed
  } catch (rejection) {
    // rate-limiter-flexible throws a RateLimiterRes object (not an Error) when
    // the limit is genuinely exceeded. It has an `msBeforeNext` number field.
    // Anything else (e.g. a Redis Error) should fail open — don't block the user.
    if (rejection && typeof rejection.msBeforeNext === "number") {
      const retryAfter = Math.ceil(rejection.msBeforeNext / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
    // Unexpected error — fail open so users are never incorrectly blocked
    console.warn("[rateLimit] Unexpected error, failing open:", rejection?.message);
    return null;
  }
}

export async function getRateLimitInfo(request, options = {}) {
  const { limit = 60, windowSeconds = 60, keyPrefix = "global", userId } = options;
  const identifier = userId || getClientIp(request);
  try {
    const info = await getLimiter(limit, windowSeconds).get(`${keyPrefix}:${identifier}`);
    return {
      remaining: info ? Math.max(0, limit - info.consumedPoints) : limit,
      resetIn: info ? Math.ceil(info.msBeforeNext / 1000) : windowSeconds,
    };
  } catch {
    return { remaining: limit, resetIn: windowSeconds };
  }
}
