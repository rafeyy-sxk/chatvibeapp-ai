/**
 * Feature Gating Middleware
 * Backend-only enforcement of subscription tiers and feature access
 * 
 * CRITICAL: All feature checks MUST be done server-side.
 * Frontend checks are for UX only and can be bypassed.
 */

import { getUserTier, getTierConfig } from "./stripe";
import { getUserSubscription } from "./subscription";
import prisma from "../prisma";
import { log } from "../logger";

/**
 * Check if user has access to a feature based on their tier
 * This is the SINGLE SOURCE OF TRUTH for feature access
 */
export async function hasFeatureAccess(userId, feature) {
  const subscription = await getUserSubscription(userId);
  const tier = subscription?.tier || "FREE";
  const tierConfig = getTierConfig(tier);

  // Check subscription status - only ACTIVE subscriptions grant access
  if (subscription && subscription.status !== "ACTIVE") {
    log.warn("User attempted to access feature with inactive subscription", {
      userId,
      feature,
      tier,
      status: subscription.status,
    });
    return false;
  }

  // Feature-specific checks
  switch (feature) {
    case "analysis":
      // All tiers can analyze, but with different limits
      return true;

    case "advanced_insights":
      // Only PRO tier
      return tier === "PRO";

    case "priority_processing":
      // BASIC and PRO tiers
      return tier === "BASIC" || tier === "PRO";

    case "export_pdf":
      // BASIC and PRO tiers
      return tier === "BASIC" || tier === "PRO";

    case "export_excel":
      // Only PRO tier
      return tier === "PRO";

    case "unlimited_credits":
      // No tier has unlimited (hard stop enforced)
      return false;

    default:
      // Unknown feature - deny by default
      log.warn("Unknown feature check", { userId, feature, tier });
      return false;
  }
}

/**
 * Check if user can create a job (credits + tier limits)
 * This is the authoritative check - frontend checks are for UX only
 */
export async function canCreateJob(userId, imageCount = 1) {
  const subscription = await getUserSubscription(userId);
  const tier = subscription?.tier || "FREE";
  const tierConfig = getTierConfig(tier);

  // Check subscription status
  if (subscription && subscription.status !== "ACTIVE") {
    return {
      allowed: false,
      reason: "INACTIVE_SUBSCRIPTION",
      message: "Your subscription is not active. Please update your payment method.",
      tier,
      subscriptionStatus: subscription.status,
    };
  }

  // Check image count limit
  if (imageCount > tierConfig.maxImagesPerJob) {
    return {
      allowed: false,
      reason: "IMAGE_LIMIT_EXCEEDED",
      message: `Your ${tierConfig.name} plan allows up to ${tierConfig.maxImagesPerJob} images per job.`,
      tier,
      maxImages: tierConfig.maxImagesPerJob,
      upgradeRequired: true,
    };
  }

  // Check credits (handled by usage tracking middleware)
  // This function focuses on tier-based limits

  return {
    allowed: true,
    tier,
    maxImages: tierConfig.maxImagesPerJob,
  };
}

/**
 * Get user's effective tier and limits
 * Returns current tier, status, and all limits
 */
export async function getUserLimits(userId) {
  const subscription = await getUserSubscription(userId);
  const tier = subscription?.tier || "FREE";
  const tierConfig = getTierConfig(tier);

  return {
    tier,
    tierName: tierConfig.name,
    status: subscription?.status || "ACTIVE", // Free tier is always "active"
    monthlyCredits: tierConfig.monthlyCredits,
    maxImagesPerJob: tierConfig.maxImagesPerJob,
    features: tierConfig.features,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  };
}

/**
 * Enforce feature access in API routes
 * Throws error if access denied
 */
export async function requireFeatureAccess(userId, feature) {
  const hasAccess = await hasFeatureAccess(userId, feature);

  if (!hasAccess) {
    const subscription = await getUserSubscription(userId);
    const tier = subscription?.tier || "FREE";
    const tierConfig = getTierConfig(tier);

    throw new Error(
      `Feature "${feature}" requires ${tierConfig.name === "Free" ? "a paid plan" : "a higher tier"}. ` +
        `Your current plan: ${tierConfig.name}`
    );
  }

  return true;
}

/**
 * Check if subscription is active and not expired
 * CRITICAL: This is the authoritative check for feature access
 */
export async function isSubscriptionActive(userId) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    // Free tier - always "active" (but with limits)
    return true;
  }

  // Check status - ONLY ACTIVE grants access
  if (subscription.status !== "ACTIVE") {
    log.debug("Subscription not active", {
      userId,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    return false;
  }

  // Check if period has ended
  const now = new Date();
  if (subscription.currentPeriodEnd < now) {
    // Period ended - subscription should be updated by webhook
    // But check anyway for safety
    log.warn("Subscription period has ended", {
      userId,
      subscriptionId: subscription.id,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
    return false;
  }

  return true;
}
