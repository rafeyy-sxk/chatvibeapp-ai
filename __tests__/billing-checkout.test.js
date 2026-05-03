/**
 * Billing Checkout Tests
 */

import { createCheckoutSession } from "../lib/billing/checkout";
import * as stripeModule from "../lib/billing/stripe";
import prisma from "../lib/prisma";

jest.mock("../lib/billing/stripe");
jest.mock("../lib/prisma");
jest.mock("../lib/billing/customer");
jest.mock("../lib/logger", () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Billing Checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createCheckoutSession", () => {
    it("should create Stripe checkout session", async () => {
      const { getOrCreateStripeCustomer } = require("../lib/billing/customer");
      getOrCreateStripeCustomer.mockResolvedValue({
        id: "cust123",
        stripeCustomerId: "cus_stripe123",
      });

      stripeModule.stripe.checkout.sessions.create.mockResolvedValue({
        id: "cs_test123",
        url: "https://checkout.stripe.com/test",
      });

      const session = await createCheckoutSession(
        "user123",
        "PRO",
        "https://example.com/success",
        "https://example.com/cancel"
      );

      expect(session.url).toBe("https://checkout.stripe.com/test");
      expect(stripeModule.stripe.checkout.sessions.create).toHaveBeenCalled();
    });

    it("should throw error if Stripe not configured", async () => {
      stripe = null;

      stripeModule.stripe = null;
      
      await expect(
        createCheckoutSession(
          "user123",
          "PRO",
          "https://example.com/success",
          "https://example.com/cancel"
        )
      ).rejects.toThrow("Stripe is not configured");
    });
  });
});

