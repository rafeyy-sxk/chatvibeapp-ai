/**
 * Stripe Customer Management
 * Create and manage Stripe customers
 */

import { stripe } from "./stripe";
import prisma from "../prisma";
import { log } from "../logger";

/**
 * Get or create Stripe customer for user
 */
export async function getOrCreateStripeCustomer(userId, email, name) {
  // Check if customer already exists
  const existing = await prisma.billingCustomer.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Create Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: {
      userId,
    },
  });

  // Create database record
  const customer = await prisma.billingCustomer.create({
    data: {
      userId,
      stripeCustomerId: stripeCustomer.id,
      email: stripeCustomer.email || email || null,
      name: stripeCustomer.name || name || null,
    },
  });

  log.info("Created Stripe customer", {
    userId,
    stripeCustomerId: stripeCustomer.id,
  });

  return customer;
}

/**
 * Get customer by user ID
 */
export async function getCustomerByUserId(userId) {
  return prisma.billingCustomer.findUnique({
    where: { userId },
    include: {
      subscription: true,
    },
  });
}

/**
 * Get customer by Stripe customer ID
 */
export async function getCustomerByStripeId(stripeCustomerId) {
  if (!stripeCustomerId) {
    return null;
  }
  return prisma.billingCustomer.findUnique({
    where: { stripeCustomerId },
    include: {
      subscription: true,
    },
  });
}

/**
 * Update customer information
 */
export async function updateCustomer(customerId, data) {
  const customer = await prisma.billingCustomer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  // Update Stripe customer if they have one
  if (customer.stripeCustomerId && stripe) {
    const stripeCustomer = await stripe.customers.update(customer.stripeCustomerId, {
      email: data.email,
      name: data.name,
      ...(data.billingAddress && { address: data.billingAddress }),
    });

    // Update database with Stripe data
    return prisma.billingCustomer.update({
      where: { id: customerId },
      data: {
        email: stripeCustomer.email || data.email,
        name: stripeCustomer.name || data.name,
        billingAddress: data.billingAddress || undefined,
      },
    });
  }

  // For free tier (no Stripe customer), just update database
  return prisma.billingCustomer.update({
    where: { id: customerId },
    data: {
      email: data.email,
      name: data.name,
      billingAddress: data.billingAddress || undefined,
    },
  });
}

