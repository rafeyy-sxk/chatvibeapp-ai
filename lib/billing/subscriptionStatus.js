/**
 * Subscription Status Utilities
 * Centralized logic for checking subscription validity and access
 */

import { getUserSubscription } from "./subscription";
import { getTierConfig } from "./stripe";
import prisma from "../prisma";
import { log } from "../logger";

/**
 * Check if user's subscription is currently active and valid
 * Returns true only if:
 * - Subscription exists AND
 * - Status is ACTIVE AND
 * - Current period has not ended
 */
export async function isSubscriptionValid(userId) {
  const subscription = await getUserSubscription(userId);

  // Free tier users are always "valid" (but with limits)
  if (!subscription) {
    return true;
  }

  // Must be ACTIVE status
  if (subscription.status !== "ACTIVE") {
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

/**
 * Get user's effective access level
 * Returns tier only if subscription is valid
 */
export async function getEffectiveTier(userId) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return "FREE";
  }

  // Only return paid tier if subscription is valid
  if (await isSubscriptionValid(userId)) {
    return subscription.tier;
  }

  // Invalid subscription - downgrade to FREE
  return "FREE";
}

/**
 * Check if user can access a specific feature
 * This is the authoritative check - frontend checks are for UX only
 */
export async function canAccessFeature(userId, feature) {
  const subscription = await getUserSubscription(userId);
  const tier = subscription?.tier || "FREE";
  const tierConfig = getTierConfig(tier);

  // First check: Subscription must be valid
  if (subscription && !(await isSubscriptionValid(userId))) {
    log.warn("User attempted to access feature with invalid subscription", {
      userId,
      feature,
      subscriptionStatus: subscription.status,
    });
    return false;
  }

  // Feature-specific access rules
  switch (feature) {
    case "analysis":
      // All tiers can analyze
      return true;

    case "advanced_insights":
      return tier === "PRO" && subscription?.status === "ACTIVE";

    case "priority_processing":
      return (tier === "BASIC" || tier === "PRO") && subscription?.status === "ACTIVE";

    case "export_pdf":
      return (tier === "BASIC" || tier === "PRO") && subscription?.status === "ACTIVE";

    case "export_excel":
      return tier === "PRO" && subscription?.status === "ACTIVE";

    default:
      return false;
  }
}

/**
 * Validate subscription and return access details
 */
export async function validateSubscriptionAccess(userId) {
  const subscription = await getUserSubscription(userId);
  const isValid = await isSubscriptionValid(userId);
  const tier = subscription?.tier || "FREE";
  const tierConfig = getTierConfig(tier);

  return {
    hasAccess: isValid,
    tier: isValid ? tier : "FREE",
    tierName: isValid ? tierConfig.name : "Free",
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    message: !isValid && subscription
      ? `Your subscription is ${subscription.status.toLowerCase()}. Please update your payment method.`
      : null,
  };
}
