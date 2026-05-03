/**
 * Security Session Manager Tests
 */

import { createUserSession, revokeUserSession } from "../lib/security/sessionManager";
import prisma from "../lib/prisma";

jest.mock("../lib/prisma");
jest.mock("../lib/logger", () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe("Session Manager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createUserSession", () => {
    it("should create user session with device tracking", async () => {
      const mockRequest = {
        headers: {
          get: jest.fn((key) => {
            if (key === "user-agent") return "Mozilla/5.0";
            if (key === "x-forwarded-for") return "192.168.1.1";
            return null;
          }),
        },
        ip: "192.168.1.1",
      };

      prisma.userSession.create.mockResolvedValue({
        id: "session123",
        userId: "user123",
        deviceFingerprint: "fp123",
      });

      const result = await createUserSession("user123", "token123", mockRequest);
      expect(result.session).toBeDefined();
      expect(prisma.userSession.create).toHaveBeenCalled();
    });

    it("should detect suspicious login", async () => {
      const mockRequest = {
        headers: {
          get: jest.fn((key) => {
            if (key === "user-agent") return "Different Browser";
            if (key === "x-forwarded-for") return "10.0.0.1";
            return null;
          }),
        },
        ip: "10.0.0.1",
      };

      // Mock previous session with different device
      prisma.userSession.findMany.mockResolvedValue([
        {
          deviceFingerprint: "different-fp",
          ipAddress: "192.168.1.1",
        },
      ]);

      prisma.userSession.create.mockResolvedValue({
        id: "session123",
        userId: "user123",
        deviceFingerprint: "fp123",
      });

      const result = await createUserSession("user123", "token123", mockRequest);
      expect(result.suspicious).toBe(true);
    });
  });

  describe("revokeUserSession", () => {
    it("should revoke user session", async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await revokeUserSession("session123");
      expect(prisma.userSession.updateMany).toHaveBeenCalled();
    });
  });
});



























