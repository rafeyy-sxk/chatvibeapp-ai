/**
 * Comprehensive Billing Usage Tests
 * Tests for credit management, usage tracking, and overage handling
 */

import {
  getCreditBalance,
  hasEnoughCredits,
  deductCredits,
  resetCreditsForPeriod,
  getUsageStats,
} from "../lib/billing/usage";
import prisma from "../lib/prisma";
import { cacheRedis } from "../lib/cache";

jest.mock("../lib/prisma");
jest.mock("../lib/cache");
jest.mock("../lib/logger", () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe("Billing Usage - Credit Management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCreditBalance", () => {
    it("should return cached balance if available", async () => {
      cacheRedis.get.mockResolvedValue("50");
      const balance = await getCreditBalance("user123");
      expect(balance).toBe(50);
      expect(cacheRedis.get).toHaveBeenCalledWith("credits:user123");
    });

    it("should calculate free tier balance from usage", async () => {
      cacheRedis.get.mockResolvedValue(null);
      prisma.billingSubscription.findFirst.mockResolvedValue(null);
      prisma.billingUsage.count.mockResolvedValue(3);
      cacheRedis.setex.mockResolvedValue("OK");

      const balance = await getCreditBalance("user123");
      expect(balance).toBe(7); // 10 free - 3 used = 7
      expect(cacheRedis.setex).toHaveBeenCalled();
    });

    it("should return subscription credits remaining", async () => {
      cacheRedis.get.mockResolvedValue(null);
      prisma.billingSubscription.findFirst.mockResolvedValue({
        creditsRemaining: 75,
      });
      cacheRedis.setex.mockResolvedValue("OK");

      const balance = await getCreditBalance("user123");
      expect(balance).toBe(75);
    });

    it("should handle cache errors gracefully", async () => {
      cacheRedis.get.mockRejectedValue(new Error("Cache error"));
      prisma.billingSubscription.findFirst.mockResolvedValue({
        creditsRemaining: 50,
      });
      cacheRedis.setex.mockResolvedValue("OK");

      const balance = await getCreditBalance("user123");
      expect(balance).toBe(50);
    });
  });

  describe("hasEnoughCredits", () => {
    it("should return true when balance is sufficient", async () => {
      cacheRedis.get.mockResolvedValue("10");
      const hasCredits = await hasEnoughCredits("user123", 5);
      expect(hasCredits).toBe(true);
    });

    it("should return false when balance is insufficient", async () => {
      cacheRedis.get.mockResolvedValue("2");
      const hasCredits = await hasEnoughCredits("user123", 5);
      expect(hasCredits).toBe(false);
    });

    it("should default to requiring 1 credit", async () => {
      cacheRedis.get.mockResolvedValue("1");
      const hasCredits = await hasEnoughCredits("user123");
      expect(hasCredits).toBe(true);
    });
  });

  describe("deductCredits", () => {
    it("should deduct credits for included usage", async () => {
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

      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
      });

      prisma.billingUsage.create.mockResolvedValue({
        id: "usage123",
        credits: 1,
        isOverage: false,
        cost: 0,
      });

      prisma.billingSubscription.update.mockResolvedValue({});
      cacheRedis.del.mockResolvedValue(1);

      const usage = await deductCredits("user123", "job123", 1);
      expect(usage.isOverage).toBe(false);
      expect(usage.cost).toBe(0);
      expect(prisma.billingSubscription.update).toHaveBeenCalled();
      expect(cacheRedis.del).toHaveBeenCalledWith("credits:user123");
    });

    it("should charge for overage usage", async () => {
      prisma.billingSubscription.findFirst.mockResolvedValue({
        id: "sub123",
        customerId: "cust123",
        monthlyCredits: 100,
        creditsUsed: 100,
        creditsRemaining: 0,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        overageRate: 0.25,
      });

      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
      });

      prisma.billingUsage.create.mockResolvedValue({
        id: "usage123",
        credits: 1,
        isOverage: true,
        cost: 0.25,
      });

      prisma.billingSubscription.update.mockResolvedValue({});
      cacheRedis.del.mockResolvedValue(1);

      const usage = await deductCredits("user123", "job123", 1);
      expect(usage.isOverage).toBe(true);
      expect(usage.cost).toBe(0.25);
    });

    it("should handle free tier users", async () => {
      prisma.billingSubscription.findFirst.mockResolvedValue(null);
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
      });

      prisma.billingUsage.count.mockResolvedValue(5);
      prisma.billingUsage.create.mockResolvedValue({
        id: "usage123",
        credits: 1,
        isOverage: false,
        cost: 0,
      });

      cacheRedis.del.mockResolvedValue(1);

      const usage = await deductCredits("user123", "job123", 1);
      expect(usage.isOverage).toBe(false);
      expect(usage.cost).toBe(0);
    });

    it("should throw error if customer not found", async () => {
      prisma.billingSubscription.findFirst.mockResolvedValue(null);
      prisma.billingCustomer.findUnique.mockResolvedValue(null);

      await expect(deductCredits("user123", "job123", 1)).rejects.toThrow(
        "Billing customer not found"
      );
    });
  });

  describe("resetCreditsForPeriod", () => {
    it("should reset credits for subscription", async () => {
      prisma.billingSubscription.findUnique.mockResolvedValue({
        id: "sub123",
        customerId: "cust123",
        tier: "PRO",
      });

      prisma.billingSubscription.update.mockResolvedValue({});
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
      });

      cacheRedis.del.mockResolvedValue(1);

      await resetCreditsForPeriod("sub123");
      expect(prisma.billingSubscription.update).toHaveBeenCalledWith({
        where: { id: "sub123" },
        data: {
          creditsUsed: 0,
          creditsRemaining: 100, // PRO tier
        },
      });
      expect(cacheRedis.del).toHaveBeenCalledWith("credits:user123");
    });

    it("should throw error if subscription not found", async () => {
      prisma.billingSubscription.findUnique.mockResolvedValue(null);

      await expect(resetCreditsForPeriod("sub123")).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("getUsageStats", () => {
    it("should return usage statistics for customer", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue({
        id: "cust123",
        userId: "user123",
      });

      prisma.billingUsage.findMany.mockResolvedValue([
        { isOverage: false, cost: 0 },
        { isOverage: false, cost: 0 },
        { isOverage: true, cost: 0.25 },
      ]);

      cacheRedis.get.mockResolvedValue("50");

      const stats = await getUsageStats(
        "user123",
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );

      expect(stats.totalJobs).toBe(3);
      expect(stats.includedJobs).toBe(2);
      expect(stats.overageJobs).toBe(1);
      expect(stats.totalCost).toBe(0.25);
      expect(stats.creditsRemaining).toBe(50);
    });

    it("should return default stats for non-customer", async () => {
      prisma.billingCustomer.findUnique.mockResolvedValue(null);
      cacheRedis.get.mockResolvedValue("10");

      const stats = await getUsageStats(
        "user123",
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );

      expect(stats.totalJobs).toBe(0);
      expect(stats.includedJobs).toBe(0);
      expect(stats.overageJobs).toBe(0);
      expect(stats.totalCost).toBe(0);
    });
  });
});



























