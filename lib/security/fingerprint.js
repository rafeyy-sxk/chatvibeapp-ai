/**
 * Device Fingerprinting & Security Utilities
 * Generates unique device fingerprints for session tracking
 */

import { createHash } from "crypto";

/**
 * Generate device fingerprint from user agent and IP
 */
export function generateDeviceFingerprint(userAgent, ipAddress) {
  const combined = `${userAgent || ""}|${ipAddress || ""}`;
  return createHash("sha256").update(combined).digest("hex").substring(0, 32);
}

/**
 * Extract browser/device info from user agent
 */
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: "Unknown",
      os: "Unknown",
      device: "Unknown",
    };
  }

  const ua = userAgent.toLowerCase();

  // Browser detection
  let browser = "Unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";

  // OS detection
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macos")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  // Device type
  let device = "Desktop";
  if (ua.includes("mobile")) device = "Mobile";
  else if (ua.includes("tablet") || ua.includes("ipad")) device = "Tablet";

  return { browser, os, device };
}

/**
 * Check if login is suspicious based on device fingerprint
 */
export async function checkSuspiciousLogin(userId, fingerprint, ipAddress, prisma) {
  // Get recent sessions for this user
  const recentSessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Check if this fingerprint is new
  const knownFingerprint = recentSessions.some(
    (session) => session.deviceFingerprint === fingerprint
  );

  // Check if IP is new
  const knownIp = recentSessions.some((session) => session.ipAddress === ipAddress);

  // Flag as suspicious if both fingerprint and IP are new
  const isSuspicious = !knownFingerprint && !knownIp && recentSessions.length > 0;

  return {
    isSuspicious,
    reason: isSuspicious ? "New device and IP address detected" : null,
    knownDevice: knownFingerprint,
    knownIp,
  };
}

/**
 * Get client IP from request
 */
export function getClientIp(request) {
  // Check various headers (for proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to connection IP (if available)
  return request.ip || "unknown";
}

/**
 * Get user agent from request
 */
export function getUserAgent(request) {
  return request.headers.get("user-agent") || "unknown";
}

