/**
 * POST /api/jobs - Create a new analysis job
 * Returns job ID immediately, processing happens asynchronously
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { addAnalysisJob } from "@/lib/queue";
import prisma from "@/lib/prisma";
import { getCorrelationId } from "@/lib/logger";
import { log, createLogger } from "@/lib/logger";
import { canCreateJob, trackJobUsage } from "@/middleware/usageTracking";
import { getUserTier, getTierConfig } from "@/lib/billing/stripe";
import { isSubscriptionActive } from "@/lib/billing/featureGating";
import { z } from "zod";

// Ensure Node.js runtime for Prisma and queue operations
export const runtime = 'nodejs';
export const maxDuration = 30;

const createJobSchema = z.object({
  images: z.array(z.string()).min(1).max(10),
  customPrompt: z.string().optional(),
});

export async function POST(request) {
  const correlationId = getCorrelationId(request);
  const logger = createLogger(correlationId);

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

    // Parse and validate request body
    const body = await request.json();
    const validation = createJobSchema.safeParse(body);

    if (!validation.success) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid request", details: validation.error.flatten() },
          { status: 400 }
        )
      );
    }

    const { images, customPrompt } = validation.data;

    // CRITICAL: Check subscription status (backend enforcement)
    const subscriptionActive = await isSubscriptionActive(authPayload.sub);
    if (!subscriptionActive) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            error: "Your subscription is not active",
            message: "Please update your payment method or renew your subscription to continue.",
            reason: "INACTIVE_SUBSCRIPTION",
            upgradeUrl: "/billing?upgrade=true",
          },
          { status: 402 } // 402 Payment Required
        )
      );
    }

    // Check credits and tier limits
    const jobCheck = await canCreateJob(authPayload.sub);
    if (!jobCheck.allowed) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            error: jobCheck.message || "Cannot create job",
            reason: jobCheck.reason,
            upgradeRequired: jobCheck.upgradeRequired,
            upgradeUrl: jobCheck.upgradeUrl,
          },
          { status: 402 } // 402 Payment Required
        )
      );
    }

    // Check tier-based image limits
    const tier = await getUserTier(authPayload.sub);
    const tierConfig = getTierConfig(tier);
    if (images.length > tierConfig.maxImagesPerJob) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            error: `Your ${tierConfig.name} plan allows up to ${tierConfig.maxImagesPerJob} images per job. Please upgrade to process more images.`,
            maxImages: tierConfig.maxImagesPerJob,
            upgradeRequired: true,
            upgradeUrl: "/billing?upgrade=true",
          },
          { status: 403 }
        )
      );
    }

    // Check API key availability
    if (!process.env.GEMINI_API_KEY) {
      logger.error("GEMINI_API_KEY not configured");
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        )
      );
    }

    // tierConfig already defined above

    // Create job record in database
    const jobRecord = await prisma.analysisJob.create({
      data: {
        userId: authPayload.sub,
        status: "QUEUED",
        progress: 0,
        imageCount: images.length,
        priority: tierConfig.priority,
        customPrompt: customPrompt || null,
      },
    });

    // Deduct credits (this must happen before queueing)
    await trackJobUsage(authPayload.sub, jobRecord.id);

    // Add job to queue
    const job = await addAnalysisJob(
      {
        userId: authPayload.sub,
        images,
        customPrompt: customPrompt || "",
        jobId: jobRecord.id,
      },
      {
        jobId: jobRecord.id,
        priority: tierConfig.priority,
      }
    );

    logger.info("Analysis job created", {
      jobId: jobRecord.id,
      queueJobId: job.id,
      userId: authPayload.sub,
      imageCount: images.length,
    });

    return applySecurityHeaders(
      NextResponse.json(
        {
          jobId: jobRecord.id,
          status: "QUEUED",
          progress: 0,
          createdAt: jobRecord.createdAt,
        },
        { status: 201 }
      )
    );
  } catch (error) {
    log.error("Error creating job", error, { correlationId });
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

