/**
 * GET /api/jobs/[id]/status - Get job status
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getJobStatus } from "@/lib/queue";
import prisma from "@/lib/prisma";
import { getCorrelationId } from "@/lib/logger";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request, { params }) {
  const correlationId = getCorrelationId(request);
  const { id } = params;

  try {
    // Authentication
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

    // Get job from database
    const job = await prisma.analysisJob.findFirst({
      where: {
        id,
        userId: authPayload.sub, // Ensure user owns this job
      },
      include: {
        report: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    if (!job) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Job not found" }, { status: 404 })
      );
    }

    // Get queue status if available
    let queueStatus = null;
    try {
      queueStatus = await getJobStatus(id);
    } catch (error) {
      log.warn("Could not get queue status", { jobId: id, error: error.message });
    }

    return applySecurityHeaders(
      NextResponse.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        errorMessage: job.errorMessage,
        retryCount: job.retryCount,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        failedAt: job.failedAt,
        reportId: job.report?.id || null,
        queueStatus: queueStatus?.status || null,
      })
    );
  } catch (error) {
    log.error("Error getting job status", error, { correlationId, jobId: id });
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

