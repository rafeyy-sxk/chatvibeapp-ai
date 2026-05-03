/**
 * Admin Authentication Middleware
 * 
 * Verifies admin access and RBAC permissions
 */

import { verifyAccessToken } from '@/lib/auth/tokens';
import { getAdminUser, hasPermission } from '@/lib/admin/rbac';
import { NextResponse } from 'next/server';

/**
 * Require admin authentication
 */
export async function requireAdminAuth(request) {
  const authPayload = verifyAccessToken(request);
  if (!authPayload) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      adminUser: null,
    };
  }

  const adminUser = await getAdminUser(authPayload.sub);
  if (!adminUser) {
    return {
      error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
      adminUser: null,
    };
  }

  return {
    error: null,
    adminUser,
  };
}

/**
 * Require admin permission
 * @param {string} permission - Required permission
 */
export function requireAdminPermission(permission) {
  return async (request) => {
    const { error, adminUser } = await requireAdminAuth(request);
    if (error) {
      return { error, adminUser: null };
    }

    const hasPerm = await hasPermission(adminUser.id, permission);
    if (!hasPerm) {
      return {
        error: NextResponse.json(
          { error: 'Permission denied', permission },
          { status: 403 }
        ),
        adminUser: null,
      };
    }

    return { error: null, adminUser };
  };
}

/**
 * Get admin user from request (helper)
 */
export async function getAdminUserFromRequest(request) {
  const authPayload = verifyAccessToken(request);
  if (!authPayload) {
    return null;
  }

  return await getAdminUser(authPayload.sub);
}

