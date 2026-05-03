/**
 * Billing Customer Management Tests
 */

import {
  getOrCreateStripeCustomer,
  getCustomerByUserId,
  getCustomerByStripeId,
  updateCustomer,
} from "../lib/billing/customer";
import { stripe } from "../lib/billing/stripe";
import prisma from "../lib/prisma";

jest.mock("../lib/billing/stripe");
jest.mock("../lib/prisma");
jest.mock("../lib/logger", () => ({
  log: {
    info: jest.fn(),
  },
}));

describe("Billing Customer Management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrCreateStripeCustomer", () => {
    it("should return existing customer", async () => {
      const existing = {
        id: "cust123",
        userId: "user123",
        stripeCustomerId: "cus_stripe123",
      };

      prisma.billingCustomer.findUnique.mockResolvedValue(existing);

      const result = await getOrCreateStripeCustomer("user123", "test@example.com", "Test User");
      expect(result).toEqual(existing);
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("should create new Stripe customer if not exists", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue(null);
      stripe.customers.create.mockResolvedValue({
        id: "cus_stripe123",
        email: "test@example.com",
        name: "Test User",
      });

      prisma.billingCustomer.create.mockResolvedValue({
        id: "cust123",
        userId: "user123",
        stripeCustomerId: "cus_stripe123",
        email: "test@example.com",
        name: "Test User",
      });

      const result = await getOrCreateStripeCustomer("user123", "test@example.com", "Test User");
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        metadata: { userId: "user123" },
      });
      expect(prisma.billingCustomer.create).toHaveBeenCalled();
    });

    it("should throw error if Stripe not configured", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue(null);
      stripe = null;

      await expect(
        getOrCreateStripeCustomer("user123", "test@example.com", "Test User")
      ).rejects.toThrow("Stripe is not configured");
    });
  });

  describe("getCustomerByUserId", () => {
    it("should return customer with subscription", async () => {
      const customer = {
        id: "cust123",
        userId: "user123",
        subscription: { id: "sub123" },
      };

      prisma.billingCustomer.findUnique.mockResolvedValue(customer);

      const result = await getCustomerByUserId("user123");
      expect(result).toEqual(customer);
      expect(prisma.billingCustomer.findUnique).toHaveBeenCalledWith({
        where: { userId: "user123" },
        include: { subscription: true },
      });
    });
  });

  describe("getCustomerByStripeId", () => {
    it("should return customer by Stripe ID", async () => {
      const customer = {
        id: "cust123",
        stripeCustomerId: "cus_stripe123",
        subscription: { id: "sub123" },
      };

      prisma.billingCustomer.findUnique.mockResolvedValue(customer);

      const result = await getCustomerByStripeId("cus_stripe123");
      expect(result).toEqual(customer);
    });
  });

  describe("updateCustomer", () => {
    it("should update customer in Stripe and database", async () => {
      const existing = {
        id: "cust123",
        stripeCustomerId: "cus_stripe123",
      };

      prisma.billingCustomer.findUnique.mockResolvedValue(existing);
      stripe.customers.update.mockResolvedValue({
        id: "cus_stripe123",
        email: "new@example.com",
        name: "New Name",
      });

      prisma.billingCustomer.update.mockResolvedValue({
        ...existing,
        email: "new@example.com",
        name: "New Name",
      });

      const result = await updateCustomer("cust123", {
        email: "new@example.com",
        name: "New Name",
      });

      expect(stripe.customers.update).toHaveBeenCalled();
      expect(prisma.billingCustomer.update).toHaveBeenCalled();
    });

    it("should throw error if customer not found", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue(null);

      await expect(
        updateCustomer("cust123", { email: "new@example.com" })
      ).rejects.toThrow("Customer not found");
    });
  });
});



























