/**
 * Billing System Tests
 * Tests for credit management, subscription handling, and usage tracking
 */

import { getCreditBalance, deductCredits, hasEnoughCredits } from "../lib/billing/usage";
import { getUserTier, createSubscription } from "../lib/billing/subscription";
import { getTierConfig } from "../lib/billing/stripe";
import prisma from "../lib/prisma";

// Mock Prisma
jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    billingSubscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    billingCustomer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    billingUsage: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock Redis cache
jest.mock("../lib/cache", () => ({
  cacheRedis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
}));

describe("Billing System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Credit Management", () => {
    it("should return correct credit balance for free tier", async () => {
      prisma.billingSubscription.findFirst.mockResolvedValue(null);
      prisma.billingUsage.count.mockResolvedValue(5);

      const balance = await getCreditBalance("user123");
      expect(balance).toBe(5); // 10 free credits - 5 used = 5 remaining
    });

    it("should return correct credit balance for paid tier", async () => {
      prisma.billingSubscription.findFirst.mockResolvedValue({
        id: "sub123",
        customerId: "cust123",
        creditsRemaining: 75,
        monthlyCredits: 100,
        creditsUsed: 25,
      });

      const balance = await getCreditBalance("user123");
      expect(balance).toBe(75);
    });

    it("should check if user has enough credits", async () => {
      prisma.billingSubscription.findFirst.mockResolvedValue({
        creditsRemaining: 10,
      });

      const hasCredits = await hasEnoughCredits("user123", 5);
      expect(hasCredits).toBe(true);
    });

    it("should return false when credits are insufficient", async () => {
      prisma.billingSubscription.findFirst.mockResolvedValue({
        creditsRemaining: 2,
      });

      const hasCredits = await hasEnoughCredits("user123", 5);
      expect(hasCredits).toBe(false);
    });
  });

  describe("Tier Configuration", () => {
    it("should return correct tier config for FREE", () => {
      const config = getTierConfig("FREE");
      expect(config.monthlyCredits).toBe(10);
      expect(config.monthlyPrice).toBe(0);
      expect(config.maxImagesPerJob).toBe(5);
    });

    it("should return correct tier config for PRO", () => {
      const config = getTierConfig("PRO");
      expect(config.monthlyCredits).toBe(100);
      expect(config.monthlyPrice).toBe(1900); // $19.00 in cents
      expect(config.maxImagesPerJob).toBe(10);
    });

    it("should return correct tier config for ELITE", () => {
      const config = getTierConfig("ELITE");
      expect(config.monthlyCredits).toBe(500);
      expect(config.monthlyPrice).toBe(4900); // $49.00 in cents
      expect(config.maxImagesPerJob).toBe(20);
    });
  });

  describe("Credit Deduction", () => {
    it("should deduct credits for included usage", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
      });

      prisma.billingSubscription.findFirst.mockResolvedValue({
        id: "sub123",
        customerId: "cust123",
        monthlyCredits: 100,
        creditsUsed: 10,
        creditsRemaining: 90,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        overageRate: 0.25,
      });

      prisma.billingUsage.create.mockResolvedValue({
        id: "usage123",
        credits: 1,
        isOverage: false,
        cost: 0,
      });

      prisma.billingSubscription.update.mockResolvedValue({});

      const usage = await deductCredits("user123", "job123", 1);
      expect(usage.isOverage).toBe(false);
      expect(usage.cost).toBe(0);
      expect(prisma.billingSubscription.update).toHaveBeenCalled();
    });

    it("should charge for overage usage", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
      });

      prisma.billingSubscription.findFirst.mockResolvedValue({
        id: "sub123",
        customerId: "cust123",
        monthlyCredits: 100,
        creditsUsed: 100, // Already used all credits
        creditsRemaining: 0,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        overageRate: 0.25,
      });

      prisma.billingUsage.create.mockResolvedValue({
        id: "usage123",
        credits: 1,
        isOverage: true,
        cost: 0.25,
      });

      const usage = await deductCredits("user123", "job123", 1);
      expect(usage.isOverage).toBe(true);
      expect(usage.cost).toBe(0.25);
    });
  });
});

