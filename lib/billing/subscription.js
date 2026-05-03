/**
 * Subscription Management
 * Handle subscription creation, updates, and cancellations
 */

import { stripe } from "./stripe";
import { getTierConfig } from "./stripe";
import prisma from "../prisma";
import { log } from "../logger";
import { getOrCreateStripeCustomer } from "./customer";

/**
 * Create or update subscription
 */
export async function createSubscription(userId, tier, paymentMethodId = null) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const tierConfig = getTierConfig(tier);
  if (!tierConfig.priceId) {
    throw new Error(`Tier ${tier} does not require a subscription`);
  }

  // Get or create customer
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { billingCustomer: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  let customer = user.billingCustomer;
  if (!customer) {
    // Create customer record (will create Stripe customer if needed)
    customer = await getOrCreateStripeCustomer(userId, user.email, user.username);
  } else if (!customer.stripeCustomerId && stripe) {
    // Free tier user upgrading - create Stripe customer now
    const stripeCustomer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.username || undefined,
      metadata: { userId },
    });

    customer = await prisma.billingCustomer.update({
      where: { id: customer.id },
      data: {
        stripeCustomerId: stripeCustomer.id,
        email: stripeCustomer.email || user.email || null,
        name: stripeCustomer.name || user.username || null,
      },
    });
  }

  // Ensure customer has Stripe customer ID
  if (!customer.stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.username || undefined,
      metadata: { userId },
    });

    customer = await prisma.billingCustomer.update({
      where: { id: customer.id },
      data: {
        stripeCustomerId: stripeCustomer.id,
        email: stripeCustomer.email || user.email || null,
        name: stripeCustomer.name || user.username || null,
      },
    });
  }

  // Attach payment method if provided
  if (paymentMethodId) {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.stripeCustomerId,
    });

    await stripe.customers.update(customer.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    await prisma.billingCustomer.update({
      where: { id: customer.id },
      data: { paymentMethodId },
    });
  }

  // Check for existing subscription
  const existing = await prisma.billingSubscription.findUnique({
    where: { customerId: customer.id },
  });

  if (existing && existing.status === "ACTIVE") {
    // Get current subscription to find item ID
    const currentSubscription = await stripe.subscriptions.retrieve(existing.stripeSubscriptionId);
    
    // Update existing subscription
    const stripeSubscription = await stripe.subscriptions.update(existing.stripeSubscriptionId, {
      items: [
        {
          id: currentSubscription.items.data[0].id,
          price: tierConfig.priceId,
        },
      ],
      proration_behavior: "always_invoice",
    });

    return updateSubscriptionFromStripe(stripeSubscription);
  }

  // Create new subscription
  const stripeSubscription = await stripe.subscriptions.create({
    customer: customer.stripeCustomerId,
    items: [{ price: tierConfig.priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });

  // Create database record
  const subscription = await prisma.billingSubscription.create({
    data: {
      customerId: customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: tierConfig.priceId,
      tier,
      status: mapStripeStatus(stripeSubscription.status),
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      monthlyCredits: tierConfig.monthlyCredits,
      creditsRemaining: tierConfig.monthlyCredits,
      creditsUsed: 0,
      overageRate: tierConfig.overageRate,
    },
  });

  log.info("Created subscription", {
    userId,
    subscriptionId: subscription.id,
    tier,
  });

  return subscription;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(userId, cancelAtPeriodEnd = true) {
  const customer = await prisma.billingCustomer.findUnique({
    where: { userId },
    include: { subscription: true },
  });

  if (!customer || !customer.subscription) {
    throw new Error("No active subscription found");
  }

  if (!customer.stripeCustomerId) {
    throw new Error("Customer does not have Stripe customer ID");
  }

  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const stripeSubscription = await stripe.subscriptions.update(
    customer.subscription.stripeSubscriptionId,
    {
      cancel_at_period_end: cancelAtPeriodEnd,
    }
  );

  return updateSubscriptionFromStripe(stripeSubscription);
}

/**
 * Update subscription from Stripe webhook
 */
export async function updateSubscriptionFromStripe(stripeSubscription) {
  // Find customer by Stripe customer ID
  const customer = await prisma.billingCustomer.findUnique({
    where: { 
      stripeCustomerId: stripeSubscription.customer,
    },
  });

  if (!customer) {
    // Try to find by Stripe customer ID in metadata or create if needed
    // This handles edge cases where customer record might not exist
    log.warn("Customer not found for subscription", { 
      stripeCustomerId: stripeSubscription.customer,
      subscriptionId: stripeSubscription.id,
    });
    throw new Error("Customer not found for subscription");
  }

  const tier = getTierFromPriceId(stripeSubscription.items.data[0].price.id);
  const tierConfig = getTierConfig(tier);

  // Get existing subscription to check if period has changed
  const existing = await prisma.billingSubscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  const newPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
  const newPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  
  // Check if this is a new billing period (period start date changed)
  const isNewPeriod = existing && 
    existing.currentPeriodStart.getTime() !== newPeriodStart.getTime();

  const subscriptionStatus = mapStripeStatus(stripeSubscription.status);
  
  const subscription = await prisma.billingSubscription.upsert({
    where: { stripeSubscriptionId: stripeSubscription.id },
    create: {
      customerId: customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      tier,
      status: subscriptionStatus,
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : null,
      monthlyCredits: tierConfig.monthlyCredits,
      creditsRemaining: subscriptionStatus === "ACTIVE" ? tierConfig.monthlyCredits : 0,
      creditsUsed: 0,
      overageRate: 0, // No overage - hard stop
    },
    update: {
      tier,
      status: subscriptionStatus,
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : null,
      monthlyCredits: tierConfig.monthlyCredits,
      overageRate: 0, // No overage - hard stop
      // Reset credits on new billing period (no rollover)
      // CRITICAL: Only reset if status is ACTIVE
      ...(isNewPeriod && subscriptionStatus === "ACTIVE" ? {
        creditsRemaining: tierConfig.monthlyCredits,
        creditsUsed: 0,
      } : {}),
      // CRITICAL: Zero out credits if subscription becomes inactive
      ...(subscriptionStatus !== "ACTIVE" ? {
        creditsRemaining: 0,
      } : {}),
    },
  });

  log.info("Subscription updated from Stripe webhook", {
    subscriptionId: subscription.id,
    tier,
    status: subscriptionStatus,
    customerId: customer.id,
    userId: customer.userId,
  });

  return subscription;
}

/**
 * Map Stripe subscription status to our enum
 */
function mapStripeStatus(stripeStatus) {
  const statusMap = {
    active: "ACTIVE",
    canceled: "CANCELED",
    past_due: "PAST_DUE",
    unpaid: "UNPAID",
    trialing: "TRIALING",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    paused: "PAUSED",
  };

  return statusMap[stripeStatus] || "ACTIVE";
}

/**
 * Get tier from Stripe price ID
 */
function getTierFromPriceId(priceId) {
  // Check environment variables first (most reliable)
  if (priceId === process.env.STRIPE_PRICE_ID_BASIC) {
    return "BASIC";
  }
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    return "PRO";
  }
  
  // Fallback: check price metadata or ID patterns
  // This handles cases where metadata might be set on the price
  if (priceId.includes("basic") || priceId.includes("_basic")) {
    return "BASIC";
  }
  if (priceId.includes("pro") && !priceId.includes("student")) {
    return "PRO";
  }
  
  return "FREE";
}

/**
 * Get user's subscription
 */
export async function getUserSubscription(userId) {
  const customer = await prisma.billingCustomer.findUnique({
    where: { userId },
    include: { subscription: true },
  });

  return customer?.subscription || null;
}

/**
 * Get user's tier (defaults to FREE if no subscription)
 * CRITICAL: Only returns tier if subscription is ACTIVE
 */
export async function getUserTier(userId) {
  const subscription = await getUserSubscription(userId);
  
  // Only return paid tier if subscription is ACTIVE
  if (subscription && subscription.status === "ACTIVE") {
    return subscription.tier;
  }
  
  // Return FREE for inactive subscriptions or no subscription
  return "FREE";
}

