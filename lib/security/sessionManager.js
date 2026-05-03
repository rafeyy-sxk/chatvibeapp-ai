/**
 * Session Management Utilities
 * Handles user session creation, tracking, and validation
 */

import prisma from "../prisma";
import { generateDeviceFingerprint, parseUserAgent, getClientIp, getUserAgent, checkSuspiciousLogin } from "./fingerprint";
import { log } from "../logger";

/**
 * Create a new user session
 */
export async function createUserSession(userId, refreshTokenId, request) {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);
  const fingerprint = generateDeviceFingerprint(userAgent, ipAddress);
  const deviceInfo = parseUserAgent(userAgent);

  // Check for suspicious login
  const suspiciousCheck = await checkSuspiciousLogin(userId, fingerprint, ipAddress, prisma);

  // Create session
  const session = await prisma.userSession.create({
    data: {
      userId,
      refreshTokenId,
      deviceFingerprint: fingerprint,
      userAgent,
      ipAddress,
      location: null, // Can be populated with IP geolocation service
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Log activity
  await prisma.userActivityLog.create({
    data: {
      userId,
      activityType: "SESSION_CREATED",
      ipAddress,
      userAgent,
      metadata: {
        deviceFingerprint: fingerprint,
        deviceInfo,
        suspicious: suspiciousCheck.isSuspicious,
        suspiciousReason: suspiciousCheck.reason,
      },
    },
  });

  // Log warning if suspicious
  if (suspiciousCheck.isSuspicious) {
    log.warn("Suspicious login detected", {
      userId,
      fingerprint,
      ipAddress,
      reason: suspiciousCheck.reason,
    });
  }

  return {
    session,
    suspicious: suspiciousCheck.isSuspicious,
    deviceInfo,
  };
}

/**
 * Get active sessions for a user
 */
export async function getUserSessions(userId) {
  return prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { lastActivityAt: "desc" },
    include: {
      refreshToken: {
        select: {
          createdAt: true,
          expiresAt: true,
        },
      },
    },
  });
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId, userId) {
  const session = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId, // Ensure user owns this session
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Revoke session
  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
    },
  });

  // Revoke associated refresh token if exists
  if (session.refreshTokenId) {
    await prisma.refreshToken.update({
      where: { id: session.refreshTokenId },
      data: { revoked: true },
    });
  }

  // Log activity
  await prisma.userActivityLog.create({
    data: {
      userId,
      activityType: "SESSION_REVOKED",
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      metadata: {
        sessionId,
        deviceFingerprint: session.deviceFingerprint,
      },
    },
  });

  return session;
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(sessionId) {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  const result = await prisma.userSession.updateMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  log.info("Cleaned up expired sessions", { count: result.count });
  return result.count;
}

