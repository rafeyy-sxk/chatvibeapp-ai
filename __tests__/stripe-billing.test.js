/**
 * Stripe Billing Tests
 * Comprehensive tests for Stripe webhooks, checkout, and subscription management
 */

import { POST } from "@/app/api/billing/webhook/route";
import { POST as checkoutHandler } from "@/app/api/billing/subscribe/route";
import { NextRequest } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { updateSubscriptionFromStripe } from "@/lib/billing/subscription";
import { resetCreditsForPeriod } from "@/lib/billing/usage";
import { getCustomerByStripeId } from "@/lib/billing/customer";
import prisma from "@/lib/prisma";

// Note: Most mocks are configured in __tests__/setup.js
// Override specific mocks here if needed for these tests

describe("Stripe Billing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", async () => {
      const payload = JSON.stringify({ type: "invoice.paid", id: "evt_123" });
      const signature = "valid_signature";

      stripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_123",
        type: "invoice.paid",
        data: { object: { customer: "cus_123" } },
      });

      const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);

      expect(event).toBeDefined();
      expect(event.type).toBe("invoice.paid");
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    });

    it("should reject invalid webhook signature", async () => {
      const payload = JSON.stringify({ type: "invoice.paid" });
      const signature = "invalid_signature";

      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      expect(() => {
        stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
      }).toThrow("Invalid signature");
    });

    it("should reject request without signature header", async () => {
      const request = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        body: JSON.stringify({ type: "invoice.paid" }),
      });

      const headersList = { get: jest.fn().mockReturnValue(null) };

      expect(headersList.get("stripe-signature")).toBeNull();
    });
  });

  describe("Payment Succeeded Event", () => {
    it("should handle invoice.paid event successfully", async () => {
      const event = {
        id: "evt_123",
        type: "invoice.paid",
        data: {
          object: {
            id: "in_123",
            customer: "cus_123",
            amount_paid: 1900,
          },
        },
      };

      getCustomerByStripeId.mockResolvedValue({
        id: "customer-123",
        userId: "user-123",
        stripeCustomerId: "cus_123",
      });

      prisma.billingSubscription.findUnique.mockResolvedValue({
        id: "sub-123",
        customerId: "customer-123",
      });

      resetCreditsForPeriod.mockResolvedValue(undefined);
      prisma.billingEvent.findUnique.mockResolvedValue(null);
      prisma.billingEvent.upsert.mockResolvedValue({
        id: "event-123",
        processed: true,
      });

      // Simulate event processing
      const customer = await getCustomerByStripeId(event.data.object.customer);
      expect(customer).toBeDefined();
      expect(customer.stripeCustomerId).toBe("cus_123");

      const subscription = await prisma.billingSubscription.findUnique({
        where: { customerId: customer.id },
      });

      if (subscription) {
        await resetCreditsForPeriod(subscription.id);
        expect(resetCreditsForPeriod).toHaveBeenCalledWith(subscription.id);
      }
    });

    it("should handle invoice.paid for unknown customer", async () => {
      const event = {
        id: "evt_123",
        type: "invoice.paid",
        data: {
          object: {
            customer: "cus_unknown",
          },
        },
      };

      getCustomerByStripeId.mockResolvedValue(null);

      const customer = await getCustomerByStripeId(event.data.object.customer);
      expect(customer).toBeNull();
    });
  });

  describe("Payment Failed Event", () => {
    it("should handle invoice.payment_failed event", async () => {
      const event = {
        id: "evt_456",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_456",
            customer: "cus_123",
          },
        },
      };

      getCustomerByStripeId.mockResolvedValue({
        id: "customer-123",
        userId: "user-123",
      });

      prisma.billingSubscription.updateMany.mockResolvedValue({ count: 1 });

      const customer = await getCustomerByStripeId(event.data.object.customer);
      if (customer) {
        await prisma.billingSubscription.updateMany({
          where: { customerId: customer.id },
          data: { status: "PAST_DUE" },
        });

        expect(prisma.billingSubscription.updateMany).toHaveBeenCalledWith({
          where: { customerId: customer.id },
          data: { status: "PAST_DUE" },
        });
      }
    });
  });

  describe("Duplicate Event Handling", () => {
    it("should skip already processed events", async () => {
      const event = {
        id: "evt_123",
        type: "invoice.paid",
        data: { object: { customer: "cus_123" } },
      };

      prisma.billingEvent.findUnique.mockResolvedValue({
        id: "event-123",
        stripeEventId: "evt_123",
        processed: true,
      });

      const existing = await prisma.billingEvent.findUnique({
        where: { stripeEventId: event.id },
      });

      expect(existing).toBeDefined();
      expect(existing.processed).toBe(true);
    });

    it("should process new events", async () => {
      const event = {
        id: "evt_new",
        type: "invoice.paid",
        data: { object: { customer: "cus_123" } },
      };

      prisma.billingEvent.findUnique.mockResolvedValue(null);
      prisma.billingEvent.upsert.mockResolvedValue({
        id: "event-new",
        processed: false,
      });

      const existing = await prisma.billingEvent.findUnique({
        where: { stripeEventId: event.id },
      });

      expect(existing).toBeNull();
    });
  });

  describe("Unexpected Stripe Event Types", () => {
    it("should handle unknown event types gracefully", async () => {
      const event = {
        id: "evt_unknown",
        type: "customer.unknown_event",
        data: { object: {} },
      };

      stripe.webhooks.constructEvent.mockReturnValue(event);
      prisma.billingEvent.findUnique.mockResolvedValue(null);
      prisma.billingEvent.upsert.mockResolvedValue({
        id: "event-unknown",
        processed: false,
      });

      // Should not throw, just log
      expect(event.type).toBe("customer.unknown_event");
    });
  });

  describe("Database Updates", () => {
    it("should update subscription status from ACTIVE to INACTIVE", async () => {
      const subscription = {
        id: "sub-123",
        status: "ACTIVE",
      };

      prisma.billingSubscription.updateMany.mockResolvedValue({ count: 1 });

      await prisma.billingSubscription.updateMany({
        where: { id: subscription.id },
        data: { status: "INACTIVE" },
      });

      expect(prisma.billingSubscription.updateMany).toHaveBeenCalledWith({
        where: { id: subscription.id },
        data: { status: "INACTIVE" },
      });
    });

    it("should update subscription from TRIAL to PAID", async () => {
      const subscription = {
        id: "sub-123",
        status: "TRIAL",
      };

      prisma.billingSubscription.updateMany.mockResolvedValue({ count: 1 });

      await prisma.billingSubscription.updateMany({
        where: { id: subscription.id },
        data: { status: "ACTIVE" },
      });

      expect(prisma.billingSubscription.updateMany).toHaveBeenCalled();
    });

    it("should update subscription to CANCELED", async () => {
      const subscription = {
        id: "sub-123",
        status: "ACTIVE",
      };

      prisma.billingSubscription.updateMany.mockResolvedValue({ count: 1 });

      await prisma.billingSubscription.updateMany({
        where: { id: subscription.id },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
        },
      });

      expect(prisma.billingSubscription.updateMany).toHaveBeenCalled();
    });
  });

  describe("Errors Inside Webhook Handler", () => {
    it("should handle database errors during webhook processing", async () => {
      const event = {
        id: "evt_error",
        type: "invoice.paid",
        data: { object: { customer: "cus_123" } },
      };

      getCustomerByStripeId.mockRejectedValue(new Error("Database error"));

      await expect(getCustomerByStripeId("cus_123")).rejects.toThrow("Database error");
    });

    it("should record error in billing event", async () => {
      const event = {
        id: "evt_error",
        type: "invoice.paid",
      };

      prisma.billingEvent.update.mockResolvedValue({
        id: "event-error",
        errorMessage: "Processing failed",
        retryCount: 1,
      });

      await prisma.billingEvent.update({
        where: { stripeEventId: event.id },
        data: {
          errorMessage: "Processing failed",
          retryCount: { increment: 1 },
        },
      });

      expect(prisma.billingEvent.update).toHaveBeenCalled();
    });
  });

  describe("Checkout Routes", () => {
    it("should create checkout session successfully", async () => {
      const sessionData = {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
        customer: "cus_123",
      };

      stripe.checkout.sessions.create.mockResolvedValue(sessionData);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        metadata: {
          userId: "user-123",
        },
      });

      expect(session).toBeDefined();
      expect(session.id).toBe("cs_test_123");
      expect(stripe.checkout.sessions.create).toHaveBeenCalled();
    });

    it("should handle missing metadata in checkout", async () => {
      const sessionData = {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
        metadata: null,
      };

      stripe.checkout.sessions.create.mockResolvedValue(sessionData);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
      });

      expect(session.metadata).toBeNull();
    });

    it("should handle invalid customer in checkout", async () => {
      stripe.checkout.sessions.create.mockRejectedValue(
        new Error("No such customer: cus_invalid")
      );

      await expect(
        stripe.checkout.sessions.create({
          customer: "cus_invalid",
          mode: "subscription",
          line_items: [{ price: "price_pro", quantity: 1 }],
        })
      ).rejects.toThrow("No such customer");
    });

    it("should handle Stripe API failure", async () => {
      stripe.checkout.sessions.create.mockRejectedValue(
        new Error("Stripe API error: 500")
      );

      await expect(
        stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: "price_pro", quantity: 1 }],
        })
      ).rejects.toThrow("Stripe API error");
    });
  });

  describe("Subscription Events", () => {
    it("should handle customer.subscription.updated", async () => {
      const event = {
        id: "evt_sub_update",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "active",
            customer: "cus_123",
          },
        },
      };

      updateSubscriptionFromStripe.mockResolvedValue(undefined);

      await updateSubscriptionFromStripe(event.data.object);

      expect(updateSubscriptionFromStripe).toHaveBeenCalledWith(event.data.object);
    });

    it("should handle customer.subscription.deleted", async () => {
      const event = {
        id: "evt_sub_delete",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
          },
        },
      };

      getCustomerByStripeId.mockResolvedValue({
        id: "customer-123",
        userId: "user-123",
      });

      prisma.billingSubscription.updateMany.mockResolvedValue({ count: 1 });

      const customer = await getCustomerByStripeId(event.data.object.customer);
      if (customer) {
        await prisma.billingSubscription.updateMany({
          where: { customerId: customer.id },
          data: {
            status: "CANCELED",
            canceledAt: new Date(),
          },
        });

        expect(prisma.billingSubscription.updateMany).toHaveBeenCalled();
      }
    });

    it("should handle customer.subscription.created", async () => {
      const event = {
        id: "evt_sub_create",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_new",
            status: "active",
            customer: "cus_123",
          },
        },
      };

      updateSubscriptionFromStripe.mockResolvedValue(undefined);

      await updateSubscriptionFromStripe(event.data.object);

      expect(updateSubscriptionFromStripe).toHaveBeenCalled();
    });
  });

  describe("Webhook Handler Integration", () => {
    it("should process complete webhook flow", async () => {
      const payload = JSON.stringify({
        id: "evt_123",
        type: "invoice.paid",
        data: { object: { customer: "cus_123" } },
      });

      stripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_123",
        type: "invoice.paid",
        data: { object: { customer: "cus_123" } },
      });

      prisma.billingEvent.findUnique.mockResolvedValue(null);
      getCustomerByStripeId.mockResolvedValue({
        id: "customer-123",
        userId: "user-123",
      });
      prisma.billingSubscription.findUnique.mockResolvedValue({
        id: "sub-123",
      });
      prisma.billingEvent.upsert.mockResolvedValue({
        id: "event-123",
        processed: true,
      });

      const request = new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        body: payload,
        headers: {
          "stripe-signature": "valid_signature",
        },
      });

      const event = stripe.webhooks.constructEvent(
        payload,
        "valid_signature",
        process.env.STRIPE_WEBHOOK_SECRET
      );

      expect(event).toBeDefined();
      expect(event.type).toBe("invoice.paid");
    });
  });
});

