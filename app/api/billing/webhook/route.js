/**
 * Stripe Webhook Handler
 * Processes Stripe webhook events with signature verification
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { updateSubscriptionFromStripe } from "@/lib/billing/subscription";
import { resetCreditsForPeriod } from "@/lib/billing/usage";
import { getCustomerByStripeId } from "@/lib/billing/customer";
import prisma from "@/lib/prisma";
import { log } from "@/lib/logger";
import { headers } from "next/headers";

// Ensure Node.js runtime for Prisma and Stripe
export const runtime = 'nodejs';
export const maxDuration = 30;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  if (!stripe || !WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret not configured");
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET);
  } catch (error) {
    log.error("Webhook signature verification failed", error);
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(event) {
  const invoice = event.data.object;
  const customerId = invoice.customer;

  const customer = await getCustomerByStripeId(customerId);
  if (!customer) {
    log.warn("Invoice paid for unknown customer", { customerId });
    return;
  }

  const subscription = await prisma.billingSubscription.findUnique({
    where: { customerId: customer.id },
  });

  if (subscription) {
    // Reset credits for new billing period
    await resetCreditsForPeriod(subscription.id);
  }

  log.info("Invoice paid, credits reset", {
    userId: customer.userId,
    invoiceId: invoice.id,
    subscriptionId: subscription?.id,
  });
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(event) {
  const invoice = event.data.object;
  const customerId = invoice.customer;

  const customer = await getCustomerByStripeId(customerId);
  if (!customer) {
    log.warn("Invoice payment failed for unknown customer", { customerId });
    return;
  }

  // Update subscription status to PAST_DUE
  await prisma.billingSubscription.updateMany({
    where: { customerId: customer.id },
    data: { status: "PAST_DUE" },
  });

  log.warn("Invoice payment failed", {
    userId: customer.userId,
    invoiceId: invoice.id,
  });
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(event) {
  const stripeSubscription = event.data.object;
  await updateSubscriptionFromStripe(stripeSubscription);
}

/**
 * Handle customer.subscription.deleted event
 * CRITICAL: This immediately revokes paid tier access
 */
async function handleSubscriptionDeleted(event) {
  const stripeSubscription = event.data.object;
  const customer = await getCustomerByStripeId(stripeSubscription.customer);

  if (customer) {
    // CRITICAL: Cancel subscription and zero credits immediately
    await prisma.billingSubscription.updateMany({
      where: { customerId: customer.id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        creditsRemaining: 0, // CRITICAL: Zero credits on cancellation
      },
    });

    // Invalidate credit cache
    try {
      const { cacheRedis } = await import("@/lib/cache");
      await cacheRedis.del(`credits:${customer.userId}`);
    } catch (error) {
      log.warn("Failed to invalidate credit cache", { userId: customer.userId, error: error.message });
    }

    log.info("Subscription canceled - access revoked", {
      userId: customer.userId,
      subscriptionId: stripeSubscription.id,
    });
  }
}

/**
 * Handle checkout.session.completed event
 * This is the critical event that confirms payment and activates subscription
 * MUST update database - frontend success page must NOT unlock features
 */
async function handleCheckoutSessionCompleted(event) {
  const session = event.data.object;
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;

  if (!userId) {
    log.warn("Checkout session completed without userId in metadata", {
      sessionId: session.id,
    });
    return;
  }

  // Get or create customer
  let customer = await prisma.billingCustomer.findUnique({
    where: { userId },
  });

  if (!customer) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      log.error("User not found for checkout session", { userId, sessionId: session.id });
      return;
    }

    // Create customer record
    customer = await prisma.billingCustomer.create({
      data: {
        userId,
        stripeCustomerId: session.customer,
        email: user.email || null,
        name: user.username || null,
      },
    });
  } else if (!customer.stripeCustomerId && session.customer) {
    // Update customer with Stripe ID
    customer = await prisma.billingCustomer.update({
      where: { id: customer.id },
      data: {
        stripeCustomerId: session.customer,
      },
    });
  }

  // CRITICAL: Retrieve subscription from Stripe and update database
  // This is the ONLY way features get unlocked - webhook updates DB
  if (session.subscription && stripe) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
      
      // Update subscription in database - this activates user's access
      await updateSubscriptionFromStripe(stripeSubscription);

      // Invalidate credit cache to reflect new subscription
      try {
        const { cacheRedis } = await import("@/lib/cache");
        await cacheRedis.del(`credits:${userId}`);
      } catch (cacheError) {
        log.warn("Failed to invalidate credit cache", { userId, error: cacheError.message });
      }

      log.info("Checkout completed, subscription activated via webhook", {
        userId,
        sessionId: session.id,
        subscriptionId: stripeSubscription.id,
        tier: tier || stripeSubscription.items.data[0]?.price?.id || "unknown",
        status: stripeSubscription.status,
      });
    } catch (error) {
      log.error("Failed to retrieve subscription after checkout", error, {
        userId,
        sessionId: session.id,
        subscriptionId: session.subscription,
      });
      // Don't throw - webhook should still return 200 to prevent retries
    }
  } else {
    log.warn("Checkout session completed without subscription", {
      userId,
      sessionId: session.id,
      mode: session.mode,
    });
  }
}

/**
 * Record webhook event for idempotency
 */
async function recordWebhookEvent(eventId, eventType, payload, processed = false) {
  const customerId = payload.data?.object?.customer;
  let customer = null;

  if (customerId) {
    customer = await getCustomerByStripeId(customerId);
  }

  return prisma.billingEvent.upsert({
    where: { stripeEventId: eventId },
    create: {
      customerId: customer?.id || null,
      stripeEventId: eventId,
      eventType,
      processed,
      payload,
    },
    update: {
      processed,
      processedAt: processed ? new Date() : null,
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (error) {
      log.error("Webhook verification failed", error);
      return NextResponse.json(
        { error: "Webhook verification failed" },
        { status: 400 }
      );
    }

    // Check if event already processed (idempotency)
    const existing = await prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existing && existing.processed) {
      log.info("Webhook event already processed", { eventId: event.id });
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Record event
    await recordWebhookEvent(event.id, event.type, event, false);

    // Process event
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event);
          break;

        case "invoice.paid":
          await handleInvoicePaid(event);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event);
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event);
          break;

        case "customer.subscription.created":
          await handleSubscriptionUpdated(event);
          break;

        default:
          log.info("Unhandled webhook event type", { type: event.type });
      }

      // Mark as processed
      await recordWebhookEvent(event.id, event.type, event, true);

      return NextResponse.json({ received: true });
    } catch (error) {
      log.error("Error processing webhook", error, {
        eventId: event.id,
        eventType: event.type,
      });

      // Update event with error
      await prisma.billingEvent.update({
        where: { stripeEventId: event.id },
        data: {
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });

      return NextResponse.json(
        { error: "Error processing webhook" },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error("Webhook handler error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

