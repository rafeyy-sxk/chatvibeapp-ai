/**
 * GET /api/jobs/[id]/results - Get job results
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import prisma from "@/lib/prisma";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request, { params }) {
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

    // Get job and report
    const job = await prisma.analysisJob.findFirst({
      where: {
        id,
        userId: authPayload.sub,
      },
      include: {
        report: true,
      },
    });

    if (!job) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Job not found" }, { status: 404 })
      );
    }

    if (job.status !== "COMPLETED") {
      return applySecurityHeaders(
        NextResponse.json({ error: "Job not completed yet" }, { status: 400 })
      );
    }

    if (!job.report) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Report not available" }, { status: 404 })
      );
    }

    return applySecurityHeaders(
      NextResponse.json({
        jobId: job.id,
        status: job.status,
        results: {
          summary: job.report.geminiSummary?.summary || "",
          overallVibe: job.report.geminiSummary?.overall_vibe || "",
          metrics: job.report.geminiSummary?.metrics || {},
          personalityTraits: job.report.geminiSummary?.personality_traits || [],
          behaviorFlags: job.report.geminiSummary?.behavior_flags || [],
          advice: job.report.geminiSummary?.advice || "",
        },
        completedAt: job.completedAt,
      })
    );
  } catch (error) {
    log.error("Error getting job results", error, { jobId: id });
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