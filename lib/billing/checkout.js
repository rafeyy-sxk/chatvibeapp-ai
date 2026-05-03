/**
 * Stripe Checkout Session Creation
 * Creates checkout sessions for subscription upgrades
 */

import { stripe } from "./stripe";
import { getTierConfig } from "./stripe";
import { getOrCreateStripeCustomer } from "./customer";
import { log } from "../logger";
import prisma from "../prisma";

/**
 * Create checkout session for subscription
 */
export async function createCheckoutSession(userId, tier, successUrl, cancelUrl) {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const tierConfig = getTierConfig(tier);
  if (!tierConfig.priceId) {
    throw new Error(`Tier ${tier} does not require payment`);
  }

  // Get or create customer
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  let customer = await getOrCreateStripeCustomer(userId, user.email, user.username);

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

  // Create checkout session
  // CRITICAL: userId and tier in metadata for webhook processing
  const session = await stripe.checkout.sessions.create({
    customer: customer.stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: tierConfig.priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId, // Required for webhook to identify user
      tier,   // Required for webhook to set correct tier
    },
    subscription_data: {
      metadata: {
        userId, // Also in subscription metadata for redundancy
        tier,
      },
    },
  });

  log.info("Created checkout session", {
    userId,
    sessionId: session.id,
    tier,
  });

  return session;
}

