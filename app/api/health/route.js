import { NextResponse } from "next/server";
import Redis from "ioredis";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import { ensureCsrfCookie } from "@/middleware/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import { analysisQueue } from "@/lib/queue";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma and Redis
export const runtime = 'nodejs';
export const maxDuration = 10;

async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "connected";
  } catch (error) {
    log.error("Database health check failed", error);
    return "disconnected";
  }
}

async function checkRedisHealth() {
  const client = new Redis(env.redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
  try {
    await client.connect();
    await client.ping();
    return "connected";
  } catch (error) {
    log.error("Redis health check failed", error);
    return "disconnected";
  } finally {
    client.disconnect();
  }
}

async function checkQueueHealth() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      analysisQueue.getWaitingCount(),
      analysisQueue.getActiveCount(),
      analysisQueue.getCompletedCount(),
      analysisQueue.getFailedCount(),
    ]);

    return {
      status: "operational",
      waiting,
      active,
      completed,
      failed,
    };
  } catch (error) {
    log.error("Queue health check failed", error);
    return {
      status: "degraded",
      error: error.message,
    };
  }
}

export async function GET(request) {
  const [database, redis, queue] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkQueueHealth(),
  ]);
  
  const status = database === "connected" && redis === "connected" && queue.status === "operational" 
    ? "ok" 
    : "degraded";
  
  const response = NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    database,
    redis,
    queue,
    uptime: Number(process.uptime().toFixed(3)),
  });
  ensureCsrfCookie(response, request.cookies.get("cv_csrf")?.value);
  return applySecurityHeaders(response);
}

