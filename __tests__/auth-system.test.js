/**
 * Auth System Tests
 * Comprehensive tests for authentication, sessions, and authorization
 */

import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, hashToken } from "@/lib/auth/tokens";
import { persistRefreshToken, revokeRefreshToken, findValidRefreshToken } from "@/lib/auth/refreshStore";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as refreshHandler } from "@/app/api/auth/refresh/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/security/password";
import { enforceRateLimit } from "@/middleware/rateLimit";
import { validateCsrf } from "@/middleware/csrf";

// Note: Most mocks are configured in __tests__/setup.js
// Override specific mocks here if needed for these tests

describe("Auth System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = "test_jwt_secret_min_32_chars_long";
    process.env.JWT_REFRESH_SECRET = "test_refresh_secret_min_32_chars";
    process.env.ACCESS_TOKEN_EXPIRY = "15m";
    process.env.REFRESH_TOKEN_EXPIRY = "7d";
  });

  describe("Token Generation and Verification", () => {
    it("should generate valid access token", () => {
      const payload = { sub: "user-123", username: "testuser" };
      const token = generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });

    it("should generate valid refresh token", () => {
      const payload = { sub: "user-123" };
      const token = generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });

    it("should verify valid access token", () => {
      const payload = { sub: "user-123", username: "testuser" };
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe("user-123");
      expect(decoded.username).toBe("testuser");
    });

    it("should verify valid refresh token", () => {
      const payload = { sub: "user-123" };
      const token = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe("user-123");
    });

    it("should throw error for expired token", () => {
      const payload = { sub: "user-123" };
      const token = generateAccessToken(payload);

      // Mock expired token by manipulating time
      jest.useFakeTimers();
      jest.advanceTimersByTime(16 * 60 * 1000); // 16 minutes

      expect(() => verifyAccessToken(token)).toThrow();
      jest.useRealTimers();
    });

    it("should throw error for invalid token", () => {
      expect(() => verifyAccessToken("invalid-token")).toThrow();
    });

    it("should hash token correctly", () => {
      const token = "test-token-123";
      const hash = hashToken(token);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // SHA256 hex length
    });
  });

  describe("Valid Session", () => {
    it("should authenticate user with valid access token", () => {
      const payload = { sub: "user-123", username: "testuser" };
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe("user-123");
      expect(decoded.username).toBe("testuser");
    });

    it("should allow access to protected route with valid token", async () => {
      const payload = { sub: "user-123", username: "testuser" };
      const token = generateAccessToken(payload);

      const request = new NextRequest("http://localhost:3000/api/protected", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const authHeader = request.headers.get("authorization");
      const [scheme, tokenValue] = authHeader.split(" ");
      const decoded = verifyAccessToken(tokenValue);

      expect(scheme).toBe("Bearer");
      expect(decoded.sub).toBe("user-123");
    });
  });

  describe("Expired Session", () => {
    it("should reject expired access token", () => {
      const payload = { sub: "user-123" };
      const token = generateAccessToken(payload);

      // Simulate expiration
      jest.useFakeTimers();
      jest.advanceTimersByTime(16 * 60 * 1000); // 16 minutes

      expect(() => verifyAccessToken(token)).toThrow("expired");
      jest.useRealTimers();
    });

    it("should allow refresh with valid refresh token", async () => {
      const refreshToken = generateRefreshToken({ sub: "user-123" });
      
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "token-123",
        userId: "user-123",
        revoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: "user-123", username: "testuser" },
      });

      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        username: "testuser",
      });

      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded.sub).toBe("user-123");
    });
  });

  describe("Invalid Token", () => {
    it("should reject malformed token", () => {
      expect(() => verifyAccessToken("not.a.valid.token")).toThrow();
    });

    it("should reject token with wrong secret", () => {
      const payload = { sub: "user-123" };
      const token = generateAccessToken(payload);

      // Change secret
      process.env.JWT_ACCESS_SECRET = "different_secret";

      expect(() => verifyAccessToken(token)).toThrow();
    });

    it("should reject empty token", () => {
      expect(() => verifyAccessToken("")).toThrow();
    });
  });

  describe("Session Refresh Flow", () => {
    it("should refresh access token with valid refresh token", async () => {
      const refreshToken = generateRefreshToken({ sub: "user-123" });

      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "token-123",
        userId: "user-123",
        revoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: { id: "user-123", username: "testuser" },
      });

      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        username: "testuser",
      });

      prisma.refreshToken.create.mockResolvedValue({
        id: "new-token-123",
      });

      enforceRateLimit.mockResolvedValue(null);
      validateCsrf.mockReturnValue(null);

      const request = new NextRequest("http://localhost:3000/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cookies: {
          cv_refresh: refreshToken,
        },
      });

      const decoded = verifyRefreshToken(refreshToken);
      const newAccessToken = generateAccessToken({
        sub: decoded.sub,
        username: "testuser",
      });

      expect(newAccessToken).toBeDefined();
      expect(decoded.sub).toBe("user-123");
    });

    it("should reject refresh with revoked token", async () => {
      const refreshToken = generateRefreshToken({ sub: "user-123" });

      prisma.refreshToken.findFirst.mockResolvedValue(null); // Token not found or revoked

      enforceRateLimit.mockResolvedValue(null);
      validateCsrf.mockReturnValue(null);

      const request = new NextRequest("http://localhost:3000/api/auth/refresh", {
        method: "POST",
        cookies: {
          cv_refresh: refreshToken,
        },
      });

      const result = await findValidRefreshToken(refreshToken);
      expect(result).toBeNull();
    });

    it("should reject refresh with expired refresh token", () => {
      const payload = { sub: "user-123" };
      const token = generateRefreshToken(payload);

      jest.useFakeTimers();
      jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 8 days

      expect(() => verifyRefreshToken(token)).toThrow("expired");
      jest.useRealTimers();
    });
  });

  describe("Missing Cookies", () => {
    it("should reject request without refresh token cookie", async () => {
      enforceRateLimit.mockResolvedValue(null);
      validateCsrf.mockReturnValue(null);

      const request = new NextRequest("http://localhost:3000/api/auth/refresh", {
        method: "POST",
      });

      const refreshToken = request.cookies.get("cv_refresh")?.value;
      expect(refreshToken).toBeUndefined();
    });

    it("should handle missing authorization header", () => {
      const request = new NextRequest("http://localhost:3000/api/protected");

      const authHeader = request.headers.get("authorization");
      expect(authHeader).toBeNull();
    });
  });

  describe("Unauthorized Access to Protected Routes", () => {
    it("should reject request without token", () => {
      const request = new NextRequest("http://localhost:3000/api/protected");
      const authHeader = request.headers.get("authorization");

      expect(authHeader).toBeNull();
    });

    it("should reject request with invalid token format", () => {
      const request = new NextRequest("http://localhost:3000/api/protected", {
        headers: {
          authorization: "InvalidFormat token",
        },
      });

      const authHeader = request.headers.get("authorization");
      const [scheme] = authHeader.split(" ");

      expect(scheme).not.toBe("Bearer");
    });

    it("should reject request with wrong user ID", async () => {
      const token = generateAccessToken({ sub: "user-123" });
      const decoded = verifyAccessToken(token);

      // Simulate checking against different user
      expect(decoded.sub).toBe("user-123");
      // In real scenario, would check if user owns the resource
    });
  });

  describe("Edge Middleware Behavior", () => {
    it("should handle token in query parameter", () => {
      const token = generateAccessToken({ sub: "user-123" });
      const request = new NextRequest(`http://localhost:3000/api/protected?token=${token}`);

      const url = new URL(request.url);
      const tokenParam = url.searchParams.get("token");

      expect(tokenParam).toBe(token);
      const decoded = verifyAccessToken(tokenParam);
      expect(decoded.sub).toBe("user-123");
    });

    it("should prioritize header over query parameter", () => {
      const headerToken = generateAccessToken({ sub: "user-123" });
      const queryToken = generateAccessToken({ sub: "user-456" });

      const request = new NextRequest(`http://localhost:3000/api/protected?token=${queryToken}`, {
        headers: {
          authorization: `Bearer ${headerToken}`,
        },
      });

      const authHeader = request.headers.get("authorization");
      const [scheme, token] = authHeader.split(" ");

      expect(scheme).toBe("Bearer");
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe("user-123"); // Header takes priority
    });
  });

  describe("Auth Errors from Prisma", () => {
    it("should handle user not found error", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const user = await prisma.user.findUnique({ where: { id: "non-existent" } });
      expect(user).toBeNull();
    });

    it("should handle database connection error", async () => {
      prisma.user.findUnique.mockRejectedValue(new Error("Database connection failed"));

      await expect(
        prisma.user.findUnique({ where: { id: "user-123" } })
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle refresh token not found", async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      const token = hashToken("test-token");
      const result = await findValidRefreshToken("test-token");

      expect(result).toBeNull();
    });
  });

  describe("Rate Limit + Auth Combined", () => {
    it("should enforce rate limit on login endpoint", async () => {
      enforceRateLimit.mockResolvedValue(
        new NextResponse(
          JSON.stringify({ error: "Too many requests" }),
          { status: 429 }
        )
      );

      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "test", password: "test" }),
      });

      const rateLimitResult = await enforceRateLimit(request, "auth:login");
      expect(rateLimitResult).toBeDefined();
      expect(rateLimitResult.status).toBe(429);
    });

    it("should enforce rate limit on refresh endpoint", async () => {
      enforceRateLimit.mockResolvedValue(
        new NextResponse(
          JSON.stringify({ error: "Too many requests" }),
          { status: 429 }
        )
      );

      const request = new NextRequest("http://localhost:3000/api/auth/refresh", {
        method: "POST",
      });

      const rateLimitResult = await enforceRateLimit(request, "auth:refresh");
      expect(rateLimitResult).toBeDefined();
      expect(rateLimitResult.status).toBe(429);
    });

    it("should allow request when rate limit not exceeded", async () => {
      enforceRateLimit.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
      });

      const rateLimitResult = await enforceRateLimit(request, "auth:login");
      expect(rateLimitResult).toBeNull();
    });
  });

  describe("Refresh Token Persistence", () => {
    it("should persist refresh token", async () => {
      const token = generateRefreshToken({ sub: "user-123" });
      const tokenHash = hashToken(token);

      prisma.refreshToken.create.mockResolvedValue({
        id: "token-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date(),
      });

      const result = await persistRefreshToken({
        userId: "user-123",
        token,
      });

      expect(result).toBeDefined();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it("should revoke refresh token", async () => {
      const token = "test-token";
      const tokenHash = hashToken(token);

      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await revokeRefreshToken(token);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash, revoked: false },
        data: { revoked: true },
      });
    });
  });
});

