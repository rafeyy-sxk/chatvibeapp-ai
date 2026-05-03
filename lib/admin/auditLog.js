/**
 * Audit Log Service
 * 
 * Centralized audit logging for compliance and security
 */

import prisma from '../prisma';

/**
 * Log an audit event
 * @param {object} params - Audit event parameters
 */
export async function logAuditEvent({
  eventType,
  userId = null,
  adminUserId = null,
  resourceType = null,
  resourceId = null,
  action,
  metadata = {},
  ipAddress,
  userAgent = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        eventType,
        userId,
        adminUserId,
        resourceType,
        resourceId,
        action,
        metadata,
        ipAddress: ipAddress || 'unknown',
        userAgent,
      },
    });
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the app
    console.error('[audit] Failed to log event', error, { eventType, userId });
  }
}

/**
 * Query audit logs with filters
 * @param {object} filters - Query filters
 * @returns {Promise<Array>} - Audit logs
 */
export async function queryAuditLogs({
  eventType = null,
  userId = null,
  adminUserId = null,
  resourceType = null,
  resourceId = null,
  startDate = null,
  endDate = null,
  limit = 100,
  offset = 0,
}) {
  const where = {};

  if (eventType) {
    where.eventType = eventType;
  }

  if (userId) {
    where.userId = userId;
  }

  if (adminUserId) {
    where.adminUserId = adminUserId;
  }

  if (resourceType) {
    where.resourceType = resourceType;
  }

  if (resourceId) {
    where.resourceId = resourceId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  return await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      adminUser: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Get audit log statistics
 * @param {object} filters - Query filters
 * @returns {Promise<object>} - Statistics
 */
export async function getAuditLogStats({
  startDate = null,
  endDate = null,
}) {
  const where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [total, byEventType, byResourceType] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['eventType'],
      where,
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ['resourceType'],
      where,
      _count: true,
    }),
  ]);

  return {
    total,
    byEventType: byEventType.map(item => ({
      eventType: item.eventType,
      count: item._count,
    })),
    byResourceType: byResourceType
      .filter(item => item.resourceType)
      .map(item => ({
        resourceType: item.resourceType,
        count: item._count,
      })),
  };
}

/**
 * Clean up old audit logs (retention: 90 days)
 */
export async function cleanupOldAuditLogs() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

/**
 * Get audit logs for a specific user (GDPR compliance)
 */
export async function getUserAuditLogs(userId) {
  return await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      adminUser: {
        select: {
          user: {
            select: {
              username: true,
            },
          },
        },
      },
    },
  });
}

