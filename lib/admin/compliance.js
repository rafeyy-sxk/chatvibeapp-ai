/**
 * GDPR Compliance Service
 * 
 * Handles data export, deletion, and session revocation
 */

import prisma from '../prisma';
import { logAuditEvent } from './auditLog';
import { log } from '../logger';
import crypto from 'crypto';

/**
 * Export all user data (GDPR compliance)
 * @param {string} userId - User ID
 * @param {string} adminUserId - Admin user ID (who requested export)
 * @param {string} ipAddress - IP address
 * @returns {Promise<object>} - Export data
 */
export async function exportUserData(userId, adminUserId = null, ipAddress = null) {
  try {
    // Log export request
    await logAuditEvent({
      eventType: 'DATA_EXPORT_REQUESTED',
      userId,
      adminUserId,
      action: 'EXPORT_REQUESTED',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress,
      metadata: { timestamp: new Date().toISOString() },
    });

    // Collect all user data
    const [user, reports, jobs, sessions, activityLogs, billingCustomer, aiProfile, relationships, pastAnalyses, adviceHistory, auditLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          lastLoginIp: true,
        },
      }),
      prisma.analysisReport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.analysisJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userActivityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.billingCustomer.findUnique({
        where: { userId },
        include: {
          subscription: true,
          usageRecords: true,
        },
      }),
      prisma.userAIProfile.findUnique({
        where: { userId },
      }),
      prisma.relationshipGraph.findMany({
        where: { userId },
      }),
      prisma.pastAnalysis.findMany({
        where: { userId },
      }),
      prisma.adviceHistory.findMany({
        where: { userId },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      user,
      analysisReports: reports,
      analysisJobs: jobs,
      sessions: sessions,
      activityLogs: activityLogs,
      billing: billingCustomer,
      aiProfile: aiProfile,
      relationships: relationships,
      pastAnalyses: pastAnalyses,
      adviceHistory: adviceHistory,
      auditLogs: auditLogs,
    };

    // Log export completion
    await logAuditEvent({
      eventType: 'DATA_EXPORT_COMPLETED',
      userId,
      adminUserId,
      action: 'EXPORT_COMPLETED',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress,
      metadata: {
        timestamp: new Date().toISOString(),
        recordCount: {
          reports: reports.length,
          jobs: jobs.length,
          sessions: sessions.length,
          activityLogs: activityLogs.length,
        },
      },
    });

    return exportData;
  } catch (error) {
    log.error('Error exporting user data', error, { userId });
    throw error;
  }
}

/**
 * Delete user data (GDPR compliance)
 * @param {string} userId - User ID
 * @param {string} adminUserId - Admin user ID (who requested deletion)
 * @param {string} ipAddress - IP address
 * @returns {Promise<object>} - Deletion result
 */
export async function deleteUserData(userId, adminUserId = null, ipAddress = null) {
  try {
    // Log deletion request
    await logAuditEvent({
      eventType: 'DATA_DELETION_REQUESTED',
      userId,
      adminUserId,
      action: 'DELETION_REQUESTED',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress,
      metadata: { timestamp: new Date().toISOString() },
    });

    // Export data before deletion (for audit trail)
    const exportData = await exportUserData(userId, adminUserId, ipAddress);

    // Anonymize user data (soft delete)
    await prisma.user.update({
      where: { id: userId },
      data: {
        username: `deleted_${crypto.randomBytes(8).toString('hex')}`,
        email: null,
        passwordHash: crypto.randomBytes(32).toString('hex'), // Random hash
        isLockedUntil: new Date('2099-12-31'), // Lock forever
      },
    });

    // Delete personal data (keep billing records for legal compliance)
    await Promise.all([
      // Delete analysis reports
      prisma.analysisReport.deleteMany({ where: { userId } }),
      // Delete analysis jobs
      prisma.analysisJob.deleteMany({ where: { userId } }),
      // Delete sessions
      prisma.userSession.deleteMany({ where: { userId } }),
      // Delete activity logs
      prisma.userActivityLog.deleteMany({ where: { userId } }),
      // Delete AI profile
      prisma.userAIProfile.deleteMany({ where: { userId } }),
      // Delete relationships
      prisma.relationshipGraph.deleteMany({ where: { userId } }),
      // Delete past analyses
      prisma.pastAnalysis.deleteMany({ where: { userId } }),
      // Delete advice history
      prisma.adviceHistory.deleteMany({ where: { userId } }),
      // Delete refresh tokens
      prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    // Anonymize audit logs (retain for compliance, but remove PII)
    await prisma.auditLog.updateMany({
      where: { userId },
      data: {
        metadata: {
          ...exportData.auditLogs[0]?.metadata,
          anonymized: true,
          anonymizedAt: new Date().toISOString(),
        },
      },
    });

    // Log deletion completion
    await logAuditEvent({
      eventType: 'DATA_DELETION_COMPLETED',
      userId,
      adminUserId,
      action: 'DELETION_COMPLETED',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress,
      metadata: {
        timestamp: new Date().toISOString(),
        exportDataSize: JSON.stringify(exportData).length,
      },
    });

    return {
      success: true,
      userId,
      deletedAt: new Date().toISOString(),
      exportDataSize: JSON.stringify(exportData).length,
    };
  } catch (error) {
    log.error('Error deleting user data', error, { userId });
    throw error;
  }
}

/**
 * Revoke all user sessions
 * @param {string} userId - User ID
 * @param {string} adminUserId - Admin user ID (who revoked sessions)
 * @param {string} ipAddress - IP address
 * @returns {Promise<object>} - Revocation result
 */
export async function revokeUserSessions(userId, adminUserId = null, ipAddress = null) {
  try {
    // Revoke all refresh tokens
    const revokedCount = await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    // Delete all active sessions
    const deletedSessions = await prisma.userSession.deleteMany({
      where: { userId, isActive: true },
    });

    // Log revocation
    await logAuditEvent({
      eventType: 'SESSION_REVOKED',
      userId,
      adminUserId,
      action: 'SESSIONS_REVOKED',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress,
      metadata: {
        timestamp: new Date().toISOString(),
        revokedTokens: revokedCount.count,
        deletedSessions: deletedSessions.count,
      },
    });

    return {
      success: true,
      userId,
      revokedTokens: revokedCount.count,
      deletedSessions: deletedSessions.count,
      revokedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error('Error revoking user sessions', error, { userId });
    throw error;
  }
}

