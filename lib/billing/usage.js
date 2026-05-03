/**
 * Usage Tracking & Credit Management
 * Track usage, deduct credits, handle overages
 */

import prisma from "../prisma";
import { getTierConfig } from "./stripe";
import { log } from "../logger";
import { cacheRedis } from "../cache";

const CREDIT_CACHE_TTL = 3600; // 1 hour

/**
 * Get user's current credit balance (cached)
 * CRITICAL: Only returns credits for ACTIVE subscriptions
 */
export async function getCreditBalance(userId) {
  const cacheKey = `credits:${userId}`;

  // Try cache first
  try {
    const cached = await cacheRedis.get(cacheKey);
    if (cached !== null) {
      return parseInt(cached, 10);
    }
  } catch (error) {
    log.warn("Credit cache read error", { userId, error: error.message });
  }

  // Get from database - ONLY ACTIVE subscriptions grant credits
  const subscription = await prisma.billingSubscription.findFirst({
    where: {
      customer: { userId },
      status: "ACTIVE", // CRITICAL: Only ACTIVE subscriptions
    },
  });

  if (!subscription) {
    // Free tier: calculate from usage this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get or create customer for free tier
    let customer = await prisma.billingCustomer.findUnique({
      where: { userId },
    });

    if (!customer) {
      // Free tier user without customer record - they have full credits
      const freeCredits = getTierConfig("FREE").monthlyCredits;
      try {
        await cacheRedis.setex(`credits:${userId}`, CREDIT_CACHE_TTL, freeCredits.toString());
      } catch (error) {
        log.warn("Credit cache write error", { userId, error: error.message });
      }
      return freeCredits;
    }

    const usage = await prisma.billingUsage.count({
      where: {
        customerId: customer.id,
        createdAt: { gte: startOfMonth },
        isOverage: false,
      },
    });

    const freeCredits = getTierConfig("FREE").monthlyCredits;
    const remaining = Math.max(0, freeCredits - usage);

    // Cache for 1 hour
    try {
      await cacheRedis.setex(cacheKey, CREDIT_CACHE_TTL, remaining.toString());
    } catch (error) {
      log.warn("Credit cache write error", { userId, error: error.message });
    }

    return remaining;
  }

  const remaining = subscription.creditsRemaining;

  // Cache for 1 hour
  try {
    await cacheRedis.setex(cacheKey, CREDIT_CACHE_TTL, remaining.toString());
  } catch (error) {
    log.warn("Credit cache write error", { userId, error: error.message });
  }

  return remaining;
}

/**
 * Check if user has enough credits
 * Hard stop: Returns false if credits are zero or insufficient
 */
export async function hasEnoughCredits(userId, required = 1) {
  const balance = await getCreditBalance(userId);
  // Hard stop - no overage allowed
  return balance >= required;
}

/**
 * Deduct credits for a job
 */
export async function deductCredits(userId, jobId, credits = 1) {
  const subscription = await prisma.billingSubscription.findFirst({
    where: {
      customer: { userId },
      status: "ACTIVE",
    },
  });

  let customer = await prisma.billingCustomer.findUnique({
    where: { userId },
  });

  // Create customer record for free tier users if it doesn't exist
  if (!customer) {
    // For free tier, create a minimal customer record without Stripe
    // This allows usage tracking without requiring Stripe setup
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // For free tier, create customer without Stripe customer ID
    // Stripe customer will be created when they subscribe
    customer = await prisma.billingCustomer.create({
      data: {
        userId,
        stripeCustomerId: null, // Free tier doesn't need Stripe customer yet
        email: user.email || null,
        name: user.username || null,
      },
    });

    log.info("Created billing customer for free tier user", { userId, customerId: customer.id });
  }

  const now = new Date();
  let periodStart, periodEnd;

  if (subscription) {
    periodStart = subscription.currentPeriodStart;
    periodEnd = subscription.currentPeriodEnd;
  } else {
    // Free tier: use calendar month
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  // Check if this is overage
  let currentUsage;
  if (subscription) {
    currentUsage = subscription.creditsUsed;
  } else {
    // Free tier: count usage in current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    currentUsage = await prisma.billingUsage.count({
      where: {
        customerId: customer.id,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        isOverage: false,
      },
    });
  }

  const monthlyAllowance = subscription
    ? subscription.monthlyCredits
    : getTierConfig("FREE").monthlyCredits;

  // Hard stop: No overage allowed for any tier
  const isOverage = currentUsage >= monthlyAllowance;
  const overageRate = 0; // No overage allowed - hard stop
  const cost = 0; // No overage billing

  // Record usage
  const usage = await prisma.billingUsage.create({
    data: {
      customerId: customer.id,
      jobId,
      credits,
      isOverage,
      cost,
      periodStart,
      periodEnd,
    },
  });

  // No overage billing - hard stop enforced
  // Credits are checked before job creation, so this should never be reached if credits are zero

  // Update subscription if exists and is ACTIVE
  // CRITICAL: Only deduct credits from ACTIVE subscriptions
  if (subscription && subscription.status === "ACTIVE") {
    // Ensure creditsRemaining never goes below 0 (hard stop)
    const newCreditsUsed = subscription.creditsUsed + credits;
    const newCreditsRemaining = Math.max(0, subscription.creditsRemaining - credits);
    
    await prisma.billingSubscription.update({
      where: { id: subscription.id },
      data: {
        creditsUsed: newCreditsUsed,
        creditsRemaining: newCreditsRemaining,
      },
    });
  } else if (subscription && subscription.status !== "ACTIVE") {
    // Log attempt to use credits with inactive subscription
    log.warn("Attempted to deduct credits from inactive subscription", {
      userId,
      jobId,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    throw new Error("Subscription is not active");
  }

  // Invalidate cache
  const cacheKey = `credits:${userId}`;
  try {
    await cacheRedis.del(cacheKey);
  } catch (error) {
    log.warn("Credit cache invalidation error", { userId, error: error.message });
  }

  log.info("Credits deducted", {
    userId,
    jobId,
    credits,
    isOverage,
    cost,
    remaining: subscription ? subscription.creditsRemaining - credits : null,
  });

  return usage;
}

/**
 * Reset credits for new billing period
 */
export async function resetCreditsForPeriod(subscriptionId) {
  const subscription = await prisma.billingSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const tierConfig = getTierConfig(subscription.tier);

  await prisma.billingSubscription.update({
    where: { id: subscriptionId },
    data: {
      creditsUsed: 0,
      creditsRemaining: tierConfig.monthlyCredits,
    },
  });

  // Invalidate cache for all users with this subscription
  const billingCustomer = await prisma.billingCustomer.findUnique({
    where: { id: subscription.customerId },
  });

  if (billingCustomer) {
    const cacheKey = `credits:${billingCustomer.userId}`;
    try {
      await cacheRedis.del(cacheKey);
    } catch (error) {
      log.warn("Credit cache invalidation error", { userId: billingCustomer.userId, error: error.message });
    }
  }

  // Invalidate cache
  const customer = await prisma.billingCustomer.findUnique({
    where: { id: subscription.customerId },
  });

  if (customer) {
    const cacheKey = `credits:${customer.userId}`;
    try {
      await cacheRedis.del(cacheKey);
    } catch (error) {
      log.warn("Credit cache invalidation error", { userId: customer.userId, error: error.message });
    }
  }

  log.info("Credits reset for new period", {
    subscriptionId,
    credits: tierConfig.monthlyCredits,
  });
}

/**
 * Get usage statistics for user
 */
export async function getUsageStats(userId, periodStart, periodEnd) {
  let customer = await prisma.billingCustomer.findUnique({
    where: { userId },
  });

  // Create customer if doesn't exist (free tier)
  if (!customer) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });

    if (user) {
      customer = await prisma.billingCustomer.create({
        data: {
          userId,
          stripeCustomerId: null,
          email: user.email || null,
          name: user.username || null,
        },
      });
    }
  }

  if (!customer) {
    return {
      totalJobs: 0,
      includedJobs: 0,
      overageJobs: 0,
      totalCost: 0,
      creditsRemaining: await getCreditBalance(userId),
    };
  }

  const usage = await prisma.billingUsage.findMany({
    where: {
      customerId: customer.id,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  const totalJobs = usage.length;
  const includedJobs = usage.filter((u) => !u.isOverage).length;
  const overageJobs = usage.filter((u) => u.isOverage).length;
  const totalCost = usage.reduce((sum, u) => sum + Number(u.cost), 0);

  return {
    totalJobs,
    includedJobs,
    overageJobs,
    totalCost,
    creditsRemaining: await getCreditBalance(userId),
  };
}

