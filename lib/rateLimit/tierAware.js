/**
 * Tier-Aware Rate Limiting
 * Implements plan-based throttling with abuse detection
 */

import { NextResponse } from "next/server";
import { getUserTier } from "@/lib/billing/subscription";
import { getTierConfig } from "@/lib/billing/stripe";
import { enforceRateLimit } from "../rateLimit";
import { detectAbuse } from "./abuseDetection";

// Tier-based rate limits per endpoint
export const TIER_RATE_LIMITS = {
  analyze: {
    FREE: { limit: 5, windowSeconds: 60 },
    BASIC: { limit: 15, windowSeconds: 60 },
    PRO: { limit: 50, windowSeconds: 60 },
  },
  reports: {
    FREE: { limit: 30, windowSeconds: 60 },
    BASIC: { limit: 100, windowSeconds: 60 },
    PRO: { limit: 300, windowSeconds: 60 },
  },
};

/**
 * Enforce tier-aware rate limiting
 * Resolves user tier and applies appropriate limits
 */
export async function enforceTierRateLimit(request, endpoint, userId) {
  // Get user tier (defaults to FREE)
  let tier = "FREE";
  if (userId) {
    try {
      tier = await getUserTier(userId);
    } catch (error) {
      console.error("[rateLimit] Error fetching user tier:", error);
      // Default to FREE on error
    }
  }

  const limits = TIER_RATE_LIMITS[endpoint]?.[tier] || TIER_RATE_LIMITS[endpoint]?.FREE;
  if (!limits) {
    throw new Error(`No rate limit configuration for endpoint: ${endpoint}`);
  }

  // Abuse detection before rate limiting
  const abuseResult = await detectAbuse(request, userId);
  if (abuseResult.blocked) {
    const retryAfter = abuseResult.retryAfter || 300;
    return NextResponse.json(
      { 
        error: "Too many requests. Please try again later.",
        retryAfter,
      },
      { 
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limits.limit),
          "X-RateLimit-Window": String(limits.windowSeconds),
          "X-RateLimit-Tier": tier,
        },
      }
    );
  }

  // Apply standard rate limiting with tier-based limits
  const rateLimitResponse = await enforceRateLimit(request, {
    limit: limits.limit,
    windowSeconds: limits.windowSeconds,
    keyPrefix: `${endpoint}:${tier}`,
    userId,
  });

  if (rateLimitResponse) {
    // Add tier info to response headers
    rateLimitResponse.headers.set("X-RateLimit-Tier", tier);
    return rateLimitResponse;
  }

  return null;
}
