/**
 * Usage Tracking Middleware
 * Tracks usage and enforces credit limits before job creation
 */

import { hasEnoughCredits, deductCredits } from "@/lib/billing/usage";
import { getUserTier, getTierConfig } from "@/lib/billing/stripe";
import { log } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Middleware to check credits before job creation
 */
export async function checkCreditsBeforeJob(userId) {
  const hasCredits = await hasEnoughCredits(userId, 1);

  if (!hasCredits) {
    const tier = await getUserTier(userId);
    const tierConfig = getTierConfig(tier);

    return {
      allowed: false,
      reason: "INSUFFICIENT_CREDITS",
      message: "You have run out of credits for this billing period.",
      tier,
      upgradeRequired: tier === "FREE",
      upgradeUrl: "/billing?upgrade=true",
    };
  }

  return { allowed: true };
}

/**
 * Middleware to deduct credits after job creation
 */
export async function trackJobUsage(userId, jobId) {
  try {
    await deductCredits(userId, jobId, 1);
    return { success: true };
  } catch (error) {
    log.error("Failed to track job usage", error, { userId, jobId });
    // Don't fail the job if usage tracking fails
    return { success: false, error: error.message };
  }
}

/**
 * Get tier-based rate limits
 */
export async function getTierRateLimit(userId) {
  const tier = await getUserTier(userId);
  const tierConfig = getTierConfig(tier);

  // Rate limits per hour
  const rateLimits = {
    FREE: { requests: 10, window: 3600 }, // 10 requests per hour
    BASIC: { requests: 50, window: 3600 }, // 50 requests per hour
    PRO: { requests: 200, window: 3600 }, // 200 requests per hour
  };

  return rateLimits[tier] || rateLimits.FREE;
}

/**
 * Check if user can create job (credits + rate limit)
 */
export async function canCreateJob(userId) {
  const creditCheck = await checkCreditsBeforeJob(userId);
  if (!creditCheck.allowed) {
    return creditCheck;
  }

  // Additional checks can be added here (rate limiting, etc.)
  return { allowed: true };
}

