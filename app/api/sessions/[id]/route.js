/**
 * DELETE /api/sessions/[id] - Revoke a session
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { revokeSession } from "@/lib/security/sessionManager";
import { getCorrelationId } from "@/lib/logger";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function DELETE(request, { params }) {
  const correlationId = getCorrelationId(request);
  const { id: sessionId } = params;

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

    await revokeSession(sessionId, authPayload.sub);

    return applySecurityHeaders(
      NextResponse.json({ success: true, message: "Session revoked" })
    );
  } catch (error) {
    if (error.message === "Session not found") {
      return applySecurityHeaders(
        NextResponse.json({ error: "Session not found" }, { status: 404 })
      );
    }

    log.error("Error revoking session", error, { correlationId, sessionId });
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

