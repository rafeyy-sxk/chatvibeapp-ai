/**
 * GET /api/sessions - Get user's active sessions
 * DELETE /api/sessions/[id] - Revoke a session
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getUserSessions, revokeSession } from "@/lib/security/sessionManager";
import { getCorrelationId } from "@/lib/logger";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request) {
  const correlationId = getCorrelationId(request);

  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    let authPayload;
    try {
      authPayload = verifyAccessToken(token);
    } catch (error) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
      );
    }

    const sessions = await getUserSessions(authPayload.sub);

    return applySecurityHeaders(
      NextResponse.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          deviceFingerprint: s.deviceFingerprint,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          location: s.location,
          lastActivityAt: s.lastActivityAt,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
      })
    );
  } catch (error) {
    log.error("Error getting sessions", error, { correlationId });
    return applySecurityHeaders(
      NextResponse.json(
        {
          error: "Internal server error",
          message: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      )
    );
  }
}

