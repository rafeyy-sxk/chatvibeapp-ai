/**
 * Abuse Detection & Prevention
 * Detects IP rotation, token reuse, distributed attacks
 */

import { getRedisClient } from "@/lib/redis";
import prisma from "@/lib/prisma";

// Lazy accessor — no Redis connection at import time
function getRedis() {
  try { return getRedisClient(); } catch { return null; }
}
// Alias used throughout the file
const redis = {
  get: async (k) => { try { return await getRedis()?.get(k); } catch { return null; } },
  sadd: async (k, v) => { try { return await getRedis()?.sadd(k, v); } catch { return null; } },
  scard: async (k) => { try { return await getRedis()?.scard(k); } catch { return null; } },
  expire: async (k, t) => { try { return await getRedis()?.expire(k, t); } catch { return null; } },
  setex: async (k, t, v) => { try { return await getRedis()?.setex(k, t, v); } catch { return null; } },
  incr: async (k) => { try { return await getRedis()?.incr(k); } catch { return null; } },
  ttl: async (k) => { try { return await getRedis()?.ttl(k); } catch { return -1; } },
};

// Abuse thresholds
const ABUSE_THRESHOLDS = {
  MAX_IPS_PER_USER_PER_HOUR: 10, // Too many IPs = potential account takeover
  MAX_USERS_PER_IP_PER_HOUR: 50, // Too many users = proxy/botnet
  MAX_FAILED_REQUESTS_PER_IP: 100, // Failed requests per hour
  SOFT_BAN_DURATION: 300, // 5 minutes
  HARD_BAN_DURATION: 3600, // 1 hour
};

/**
 * Extract IP from request
 */
function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.ip || "unknown";
}

/**
 * Track IP usage per user
 */
async function trackUserIp(userId, ip) {
  if (!redis || !userId) return;
  
  const key = `abuse:userIps:${userId}`;
  const hourKey = `abuse:userIps:${userId}:${Math.floor(Date.now() / 3600000)}`;
  
  try {
    // Track IPs per hour
    await redis.sadd(hourKey, ip);
    await redis.expire(hourKey, 7200); // 2 hour expiry
    
    // Check count
    const count = await redis.scard(hourKey);
    if (count > ABUSE_THRESHOLDS.MAX_IPS_PER_USER_PER_HOUR) {
      // Soft ban user
      await redis.setex(`abuse:softBan:user:${userId}`, ABUSE_THRESHOLDS.SOFT_BAN_DURATION, "1");
      return { banned: true, reason: "too_many_ips" };
    }
  } catch (error) {
    console.error("[abuseDetection] Error tracking user IPs:", error);
  }
  
  return { banned: false };
}

/**
 * Track users per IP
 */
async function trackIpUsers(ip, userId) {
  if (!redis || !ip || ip === "unknown") return;
  
  const hourKey = `abuse:ipUsers:${ip}:${Math.floor(Date.now() / 3600000)}`;
  
  try {
    if (userId) {
      await redis.sadd(hourKey, userId);
    } else {
      await redis.incr(hourKey);
    }
    await redis.expire(hourKey, 7200);
    
    const count = userId 
      ? await redis.scard(hourKey)
      : await redis.get(hourKey);
    
    if (parseInt(count) > ABUSE_THRESHOLDS.MAX_USERS_PER_IP_PER_HOUR) {
      // Soft ban IP
      await redis.setex(`abuse:softBan:ip:${ip}`, ABUSE_THRESHOLDS.SOFT_BAN_DURATION, "1");
      return { banned: true, reason: "too_many_users" };
    }
  } catch (error) {
    console.error("[abuseDetection] Error tracking IP users:", error);
  }
  
  return { banned: false };
}

/**
 * Track failed requests (429s, auth failures, etc.)
 */
async function trackFailedRequest(ip, userId) {
  if (!redis) return;
  
  const hourKey = `abuse:failed:${ip}:${Math.floor(Date.now() / 3600000)}`;
  
  try {
    const count = await redis.incr(hourKey);
    await redis.expire(hourKey, 7200);
    
    if (count > ABUSE_THRESHOLDS.MAX_FAILED_REQUESTS_PER_IP) {
      // Hard ban IP
      await redis.setex(`abuse:hardBan:ip:${ip}`, ABUSE_THRESHOLDS.HARD_BAN_DURATION, "1");
      return { banned: true, reason: "too_many_failures" };
    }
  } catch (error) {
    console.error("[abuseDetection] Error tracking failed requests:", error);
  }
  
  return { banned: false };
}

/**
 * Check if user/IP is banned
 */
async function checkBan(userId, ip) {
  if (!redis) return { blocked: false };
  
  try {
    // Check soft bans
    const userSoftBan = await redis.get(`abuse:softBan:user:${userId}`);
    if (userSoftBan) {
      const ttl = await redis.ttl(`abuse:softBan:user:${userId}`);
      return { blocked: true, retryAfter: ttl, reason: "soft_ban_user" };
    }
    
    const ipSoftBan = await redis.get(`abuse:softBan:ip:${ip}`);
    if (ipSoftBan) {
      const ttl = await redis.ttl(`abuse:softBan:ip:${ip}`);
      return { blocked: true, retryAfter: ttl, reason: "soft_ban_ip" };
    }
    
    // Check hard bans
    const ipHardBan = await redis.get(`abuse:hardBan:ip:${ip}`);
    if (ipHardBan) {
      const ttl = await redis.ttl(`abuse:hardBan:ip:${ip}`);
      return { blocked: true, retryAfter: ttl, reason: "hard_ban_ip" };
    }
  } catch (error) {
    console.error("[abuseDetection] Error checking bans:", error);
  }
  
  return { blocked: false };
}

/**
 * Main abuse detection function
 */
export async function detectAbuse(request, userId) {
  try {
    const ip = getClientIp(request);
    const banCheck = await checkBan(userId, ip);
    if (banCheck.blocked) return banCheck;

    if (userId) {
      const userIpCheck = await trackUserIp(userId, ip);
      if (userIpCheck?.banned) {
        return { blocked: true, retryAfter: ABUSE_THRESHOLDS.SOFT_BAN_DURATION, reason: userIpCheck.reason };
      }
    }

    const ipUserCheck = await trackIpUsers(getClientIp(request), userId);
    if (ipUserCheck?.banned) {
      return { blocked: true, retryAfter: ABUSE_THRESHOLDS.SOFT_BAN_DURATION, reason: ipUserCheck.reason };
    }
  } catch {
    // Redis unavailable — fail open, never block legitimate users
  }
  return { blocked: false };
}

/**
 * Record failed request (call this when returning 429, 401, etc.)
 */
export async function recordFailedRequest(request, userId) {
  const ip = getClientIp(request);
  return trackFailedRequest(ip, userId);
}

/**
 * Check database for suspicious patterns (complementary to Redis)
 */
export async function checkDatabaseAbuse(userId, ip) {
  try {
    // Check recent failed logins
    const recentFailures = await prisma.userActivityLog.count({
      where: {
        userId,
        activityType: "LOGIN_FAILED",
        createdAt: {
          gte: new Date(Date.now() - 3600000), // Last hour
        },
      },
    });
    
    if (recentFailures > 10) {
      return { suspicious: true, reason: "too_many_failed_logins" };
    }
    
    // Check IP diversity (too many different IPs recently)
    const recentIps = await prisma.userActivityLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 3600000),
        },
      },
      select: { ipAddress: true },
      distinct: ["ipAddress"],
    });
    
    if (recentIps.length > ABUSE_THRESHOLDS.MAX_IPS_PER_USER_PER_HOUR) {
      return { suspicious: true, reason: "too_many_ips_database" };
    }
  } catch (error) {
    console.error("[abuseDetection] Database check error:", error);
  }
  
  return { suspicious: false };
}
