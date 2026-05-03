/**
 * Billing Subscription Management Tests
 */

import {
  createSubscription,
  cancelSubscription,
  updateSubscriptionFromStripe,
  getUserSubscription,
  getUserTier,
} from "../lib/billing/subscription";
import { stripe } from "../lib/billing/stripe";
import prisma from "../lib/prisma";
import { getOrCreateStripeCustomer } from "../lib/billing/customer";

jest.mock("../lib/billing/stripe");
jest.mock("../lib/prisma");
jest.mock("../lib/billing/customer");
jest.mock("../lib/logger", () => ({
  log: {
    info: jest.fn(),
  },
}));

describe("Billing Subscription Management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createSubscription", () => {
    it("should create new subscription", async () => {
      const user = {
        id: "user123",
        email: "test@example.com",
        username: "testuser",
        billingCustomer: null,
      };

      prisma.user.findUnique.mockResolvedValue(user);
      getOrCreateStripeCustomer.mockResolvedValue({
        id: "cust123",
        stripeCustomerId: "cus_stripe123",
      });

      prisma.billingSubscription.findUnique.mockResolvedValue(null);

      stripe.subscriptions.create.mockResolvedValue({
        id: "sub_stripe123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        items: {
          data: [{ price: { id: "price_pro" } }],
        },
      });

      prisma.billingSubscription.create.mockResolvedValue({
        id: "sub123",
        tier: "PRO",
        status: "ACTIVE",
      });

      const result = await createSubscription("user123", "PRO");
      expect(result.tier).toBe("PRO");
      expect(stripe.subscriptions.create).toHaveBeenCalled();
    });

    it("should update existing subscription", async () => {
      const user = {
        id: "user123",
        email: "test@example.com",
        username: "testuser",
        billingCustomer: {
          id: "cust123",
          stripeCustomerId: "cus_stripe123",
        },
      };

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.billingSubscription.findUnique.mockResolvedValue({
        id: "sub123",
        stripeSubscriptionId: "sub_stripe123",
        status: "ACTIVE",
      });

      stripe.subscriptions.retrieve.mockResolvedValue({
        id: "sub_stripe123",
        items: {
          data: [{ id: "si_item123", price: { id: "price_pro" } }],
        },
      });

      stripe.subscriptions.update.mockResolvedValue({
        id: "sub_stripe123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        items: {
          data: [{ price: { id: "price_elite" } }],
        },
      });

      prisma.billingSubscription.upsert.mockResolvedValue({
        id: "sub123",
        tier: "ELITE",
      });

      const result = await createSubscription("user123", "ELITE");
      expect(stripe.subscriptions.update).toHaveBeenCalled();
    });

    it("should throw error for FREE tier", async () => {
      await expect(createSubscription("user123", "FREE")).rejects.toThrow(
        "does not require a subscription"
      );
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel subscription", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
        subscription: {
          id: "sub123",
          stripeSubscriptionId: "sub_stripe123",
        },
      });

      stripe.subscriptions.update.mockResolvedValue({
        id: "sub_stripe123",
        cancel_at_period_end: true,
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        items: {
          data: [{ price: { id: "price_pro" } }],
        },
      });

      prisma.billingSubscription.upsert.mockResolvedValue({
        id: "sub123",
        cancelAtPeriodEnd: true,
      });

      const result = await cancelSubscription("user123", true);
      expect(stripe.subscriptions.update).toHaveBeenCalled();
    });
  });

  describe("getUserSubscription", () => {
    it("should return user subscription", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        subscription: { id: "sub123", tier: "PRO" },
      });

      const result = await getUserSubscription("user123");
      expect(result.tier).toBe("PRO");
    });

    it("should return null if no subscription", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        subscription: null,
      });

      const result = await getUserSubscription("user123");
      expect(result).toBeNull();
    });
  });

  describe("getUserTier", () => {
    it("should return user tier", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        subscription: { tier: "PRO" },
      });

      const tier = await getUserTier("user123");
      expect(tier).toBe("PRO");
    });

    it("should return FREE if no subscription", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        subscription: null,
      });

      const tier = await getUserTier("user123");
      expect(tier).toBe("FREE");
    });
  });

  describe("updateSubscriptionFromStripe", () => {
    it("should update subscription from Stripe webhook", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        stripeCustomerId: "cus_stripe123",
      });

      const stripeSubscription = {
        id: "sub_stripe123",
        customer: "cus_stripe123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        items: {
          data: [{ price: { id: "price_pro" } }],
        },
      };

      prisma.billingSubscription.upsert.mockResolvedValue({
        id: "sub123",
        tier: "PRO",
        status: "ACTIVE",
      });

      const result = await updateSubscriptionFromStripe(stripeSubscription);
      expect(result.tier).toBe("PRO");
    });
  });
});



























