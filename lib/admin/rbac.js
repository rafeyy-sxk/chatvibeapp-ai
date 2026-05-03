/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Manages admin permissions and access control
 */

import prisma from '../prisma';

// Permission definitions
const PERMISSIONS = {
  // User management
  USERS_VIEW: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'],
  USERS_CREATE: ['SUPER_ADMIN', 'ADMIN'],
  USERS_UPDATE: ['SUPER_ADMIN', 'ADMIN'],
  USERS_DELETE: ['SUPER_ADMIN'],

  // Team management
  TEAMS_VIEW: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'],
  TEAMS_CREATE: ['SUPER_ADMIN', 'ADMIN'],
  TEAMS_UPDATE: ['SUPER_ADMIN', 'ADMIN'],
  TEAMS_DELETE: ['SUPER_ADMIN'],

  // Billing management
  BILLING_VIEW: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'],
  BILLING_UPDATE: ['SUPER_ADMIN', 'ADMIN'],
  BILLING_REFUND: ['SUPER_ADMIN', 'ADMIN'],

  // Audit logs
  AUDIT_VIEW: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'],
  AUDIT_EXPORT: ['SUPER_ADMIN', 'ADMIN'],

  // System health
  HEALTH_VIEW: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'],

  // Admin management
  ADMINS_VIEW: ['SUPER_ADMIN', 'ADMIN'],
  ADMINS_CREATE: ['SUPER_ADMIN'],
  ADMINS_UPDATE: ['SUPER_ADMIN'],
  ADMINS_DELETE: ['SUPER_ADMIN'],

  // Compliance
  COMPLIANCE_EXPORT: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  COMPLIANCE_DELETE: ['SUPER_ADMIN', 'ADMIN'],
  COMPLIANCE_REVOKE_SESSION: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],

  // System configuration
  CONFIG_VIEW: ['SUPER_ADMIN', 'ADMIN'],
  CONFIG_UPDATE: ['SUPER_ADMIN'],
};

/**
 * Check if admin has permission
 * @param {string} adminUserId - Admin user ID
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} - Has permission
 */
export async function hasPermission(adminUserId, permission) {
  const adminUser = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
  });

  if (!adminUser) {
    return false;
  }

  // SUPER_ADMIN has all permissions
  if (adminUser.role === 'SUPER_ADMIN') {
    return true;
  }

  // Check role-based permissions
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }

  if (allowedRoles.includes(adminUser.role)) {
    // Check custom permissions override
    if (adminUser.permissions) {
      const customPerms = adminUser.permissions;
      if (customPerms[permission] !== undefined) {
        return customPerms[permission];
      }
    }
    return true;
  }

  return false;
}

/**
 * Get admin user by user ID
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} - Admin user
 */
export async function getAdminUser(userId) {
  return await prisma.adminUser.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Create admin user
 * @param {object} params - Admin user parameters
 * @returns {Promise<object>} - Created admin user
 */
export async function createAdminUser({
  userId,
  role = 'VIEWER',
  permissions = null,
  createdBy = null,
}) {
  return await prisma.adminUser.create({
    data: {
      userId,
      role,
      permissions,
      createdBy,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Update admin user
 * @param {string} adminUserId - Admin user ID
 * @param {object} updates - Updates
 * @returns {Promise<object>} - Updated admin user
 */
export async function updateAdminUser(adminUserId, updates) {
  return await prisma.adminUser.update({
    where: { id: adminUserId },
    data: {
      ...updates,
      updatedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Update admin last login
 * @param {string} adminUserId - Admin user ID
 */
export async function updateAdminLastLogin(adminUserId) {
  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Get all admin users
 * @returns {Promise<Array>} - Admin users
 */
export async function getAllAdminUsers() {
  return await prisma.adminUser.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      createdByUser: {
        select: {
          user: {
            select: {
              username: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Require permission middleware helper
 * @param {string} permission - Required permission
 * @returns {Function} - Middleware function
 */
export function requirePermission(permission) {
  return async (adminUserId) => {
    const hasPerm = await hasPermission(adminUserId, permission);
    if (!hasPerm) {
      throw new Error(`Permission denied: ${permission}`);
    }
    return true;
  };
}

