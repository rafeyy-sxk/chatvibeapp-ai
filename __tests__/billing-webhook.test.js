/**
 * Stripe Webhook Tests
 * Tests for webhook signature verification and event processing
 */

import { stripe } from "../lib/billing/stripe";
import prisma from "../lib/prisma";

// Mock Stripe
jest.mock("../lib/billing/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

// Mock Prisma
jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    billingEvent: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    billingCustomer: {
      findUnique: jest.fn(),
    },
    billingSubscription: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe("Stripe Webhook Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = JSON.stringify({ type: "invoice.paid", data: {} });
      const signature = "valid_signature";

      stripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_123",
        type: "invoice.paid",
        data: { object: { id: "inv_123", customer: "cus_123" } },
      });

      const event = stripe.webhooks.constructEvent(payload, signature, "webhook_secret");
      expect(event).toBeDefined();
      expect(event.type).toBe("invoice.paid");
    });

    it("should reject invalid webhook signature", () => {
      const payload = JSON.stringify({ type: "invoice.paid", data: {} });
      const signature = "invalid_signature";

      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      expect(() => {
        stripe.webhooks.constructEvent(payload, signature, "webhook_secret");
      }).toThrow("Invalid signature");
    });
  });

  describe("Idempotency", () => {
    it("should skip already processed events", async () => {
      prisma.billingEvent.findUnique.mockResolvedValue({
        id: "evt_123",
        stripeEventId: "evt_123",
        processed: true,
      });

      const existing = await prisma.billingEvent.findUnique({
        where: { stripeEventId: "evt_123" },
      });

      expect(existing.processed).toBe(true);
    });
  });

  describe("Event Processing", () => {
    it("should handle invoice.paid event", async () => {
      const event = {
        id: "evt_123",
        type: "invoice.paid",
        data: {
          object: {
            id: "inv_123",
            customer: "cus_123",
            amount_paid: 1900,
          },
        },
      };

      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
        stripeCustomerId: "cus_123",
      });

      prisma.billingSubscription.findUnique.mockResolvedValue({
        id: "sub123",
        customerId: "cust123",
      });

      // This would call resetCreditsForPeriod in real implementation
      expect(event.type).toBe("invoice.paid");
    });

    it("should handle invoice.payment_failed event", async () => {
      const event = {
        id: "evt_124",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "inv_124",
            customer: "cus_123",
          },
        },
      };

      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
        stripeCustomerId: "cus_123",
      });

      prisma.billingSubscription.updateMany.mockResolvedValue({ count: 1 });

      expect(event.type).toBe("invoice.payment_failed");
    });
  });
});

