/**
 * System Health Monitoring Service
 * 
 * Collects and stores system health metrics
 */

import prisma from '../prisma';
import { getRedisClient } from '../redis';
import { log } from '../logger';

const redis = getRedisClient();

/**
 * Collect system health snapshot
 * @returns {Promise<object>} - Health snapshot
 */
export async function collectHealthSnapshot() {
  try {
    const metrics = await collectMetrics();
    const status = determineHealthStatus(metrics);
    const alerts = generateAlerts(metrics);

    const snapshot = await prisma.systemHealthSnapshot.create({
      data: {
        metrics,
        status,
        alerts,
      },
    });

    // Cache current status in Redis (5 minute TTL)
    await redis.setex('system:health:current', 300, JSON.stringify({
      status,
      metrics,
      alerts,
      timestamp: snapshot.timestamp,
    }));

    return snapshot;
  } catch (error) {
    log.error('Failed to collect health snapshot', error);
    throw error;
  }
}

/**
 * Collect system metrics
 */
async function collectMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
  };

  try {
    // Database health
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    metrics.databaseLatency = Date.now() - dbStart;
    metrics.databaseStatus = 'connected';

    // Redis health
    try {
      const redisStart = Date.now();
      await redis.ping();
      metrics.redisLatency = Date.now() - redisStart;
      metrics.redisStatus = 'connected';
    } catch (error) {
      metrics.redisStatus = 'disconnected';
      metrics.redisError = error.message;
    }

    // Job queue metrics (if available)
    try {
      const { analysisQueue } = await import('../queue');
      const [waiting, active, completed, failed] = await Promise.all([
        analysisQueue.getWaitingCount(),
        analysisQueue.getActiveCount(),
        analysisQueue.getCompletedCount(),
        analysisQueue.getFailedCount(),
      ]);

      metrics.jobQueue = {
        waiting,
        active,
        completed,
        failed,
        total: waiting + active + completed + failed,
      };
    } catch (error) {
      metrics.jobQueue = { error: 'Queue unavailable' };
    }

    // User activity (last hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const activeUsers = await prisma.userActivityLog.count({
      where: {
        createdAt: { gte: oneHourAgo },
        activityType: 'LOGIN',
      },
    });
    metrics.activeUsers = activeUsers;

    // Error rate (last hour)
    const errorCount = await prisma.analysisJob.count({
      where: {
        status: 'FAILED',
        failedAt: { gte: oneHourAgo },
      },
    });
    const totalJobs = await prisma.analysisJob.count({
      where: {
        createdAt: { gte: oneHourAgo },
      },
    });
    metrics.errorRate = totalJobs > 0 ? (errorCount / totalJobs) * 100 : 0;

    // Memory usage (if available)
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      metrics.memory = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      };
    }

  } catch (error) {
    log.error('Error collecting metrics', error);
    metrics.error = error.message;
  }

  return metrics;
}

/**
 * Determine health status from metrics
 */
function determineHealthStatus(metrics) {
  // Check critical systems
  if (metrics.databaseStatus !== 'connected') {
    return 'DOWN';
  }

  if (metrics.redisStatus === 'disconnected') {
    return 'DEGRADED';
  }

  // Check error rate
  if (metrics.errorRate > 10) {
    return 'DEGRADED';
  }

  // Check database latency
  if (metrics.databaseLatency > 1000) {
    return 'DEGRADED';
  }

  // Check job queue depth
  if (metrics.jobQueue?.waiting > 100) {
    return 'DEGRADED';
  }

  // Check memory usage
  if (metrics.memory?.heapUsed > 1000) { // > 1GB
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

/**
 * Generate alerts from metrics
 */
function generateAlerts(metrics) {
  const alerts = [];

  if (metrics.databaseStatus !== 'connected') {
    alerts.push({
      level: 'critical',
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }

  if (metrics.redisStatus === 'disconnected') {
    alerts.push({
      level: 'warning',
      message: 'Redis connection failed',
      timestamp: new Date().toISOString(),
    });
  }

  if (metrics.errorRate > 10) {
    alerts.push({
      level: 'warning',
      message: `High error rate: ${metrics.errorRate.toFixed(2)}%`,
      timestamp: new Date().toISOString(),
    });
  }

  if (metrics.jobQueue?.waiting > 100) {
    alerts.push({
      level: 'warning',
      message: `High job queue depth: ${metrics.jobQueue.waiting} waiting`,
      timestamp: new Date().toISOString(),
    });
  }

  if (metrics.memory?.heapUsed > 1000) {
    alerts.push({
      level: 'warning',
      message: `High memory usage: ${metrics.memory.heapUsed}MB`,
      timestamp: new Date().toISOString(),
    });
  }

  return alerts;
}

/**
 * Get current health status (from cache or latest snapshot)
 */
export async function getCurrentHealth() {
  try {
    // Try cache first
    const cached = await redis.get('system:health:current');
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to latest snapshot
    const latest = await prisma.systemHealthSnapshot.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    if (latest) {
      return {
        status: latest.status,
        metrics: latest.metrics,
        alerts: latest.alerts,
        timestamp: latest.timestamp,
      };
    }

    return {
      status: 'UNKNOWN',
      metrics: {},
      alerts: [],
      timestamp: new Date(),
    };
  } catch (error) {
    log.error('Error getting current health', error);
    return {
      status: 'UNKNOWN',
      metrics: {},
      alerts: [],
      timestamp: new Date(),
    };
  }
}

/**
 * Get health history
 * @param {number} hours - Number of hours to retrieve
 * @returns {Promise<Array>} - Health snapshots
 */
export async function getHealthHistory(hours = 24) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  return await prisma.systemHealthSnapshot.findMany({
    where: {
      timestamp: { gte: startDate },
    },
    orderBy: { timestamp: 'asc' },
  });
}

/**
 * Clean up old health snapshots (retention: 30 days)
 */
export async function cleanupOldHealthSnapshots() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const result = await prisma.systemHealthSnapshot.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

