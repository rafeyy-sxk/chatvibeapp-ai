/**
 * Auth Lockout Tests
 */

import { isLocked, registerFailedLogin, resetFailedLogins } from "../lib/auth/lockout";
import prisma from "../lib/prisma";

jest.mock("../lib/prisma");

describe("Auth Lockout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isLocked", () => {
    it("should return false for unlocked account", () => {
      const user = {
        failedLoginCount: 2,
        isLockedUntil: null,
      };

      expect(isLocked(user)).toBe(false);
    });

    it("should return true if locked until future date", () => {
      const user = {
        failedLoginCount: 5,
        isLockedUntil: new Date(Date.now() + 10000),
      };

      expect(isLocked(user)).toBe(true);
    });

    it("should return false if lock expired", () => {
      const user = {
        failedLoginCount: 5,
        isLockedUntil: new Date(Date.now() - 10000),
      };

      expect(isLocked(user)).toBe(false);
    });
  });

  describe("registerFailedLogin", () => {
    it("should increment failed login count", async () => {
      prisma.user.update.mockResolvedValue({
        id: "user123",
        failedLoginCount: 1,
      });

      await registerFailedLogin("user123");
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("should lock account after 5 failed attempts", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user123",
        failedLoginCount: 4,
      });

      prisma.user.update.mockResolvedValue({
        id: "user123",
        failedLoginCount: 5,
        isLockedUntil: new Date(Date.now() + 900000),
      });

      await registerFailedLogin("user123");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: expect.objectContaining({
          isLockedUntil: expect.any(Date),
        }),
      });
    });
  });

  describe("resetFailedLogins", () => {
    it("should reset failed login count", async () => {
      prisma.user.update.mockResolvedValue({
        id: "user123",
        failedLoginCount: 0,
        isLockedUntil: null,
      });

      await resetFailedLogins("user123");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: {
          failedLoginCount: 0,
          isLockedUntil: null,
        },
      });
    });
  });
});



























