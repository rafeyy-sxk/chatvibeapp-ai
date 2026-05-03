/**
 * POST /api/analyze - Queue chat analysis job
 * App Router route handler
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { log } from "@/lib/logger";
import { enforceTierRateLimit } from "@/lib/rateLimit/tierAware";
import { recordFailedRequest } from "@/lib/rateLimit/abuseDetection";
import { isSubscriptionActive } from "@/lib/billing/featureGating";
import { addAnalysisJob } from "@/lib/queue";

// Vercel configuration
export const runtime = "nodejs";
export const maxDuration = 10; // Short execution for queuing

function ensureAuthorized(request) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  try {
    return verifyAccessToken(token);
  } catch (error) {
    return null;
  }
}

export async function POST(request) {
  let authPayload = null;
  try {
    authPayload = ensureAuthorized(request);
    if (!authPayload) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized request" }, { status: 403 })
      );
    }

    // Check subscription status
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
          { status: 402 }
        )
      );
    }

    const rateLimitResponse = await enforceTierRateLimit(
      request,
      "analyze",
      authPayload.sub
    );

    if (rateLimitResponse) {
      await recordFailedRequest(request, authPayload.sub);
      return applySecurityHeaders(rateLimitResponse);
    }

    // Parse request body
    const body = await request.json();
    const { text, customPrompt } = body;

    // Validate input
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "No text provided. Expected a non-empty string." },
          { status: 400 }
        )
      );
    }

    if (text.length > 10 * 1024 * 1024) { // 10MB limit
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Text too large. Maximum 10MB allowed." },
          { status: 400 }
        )
      );
    }

    // Check credits (hard stop)
    const user = await prisma.user.findUnique({
      where: { id: authPayload.sub },
      select: { credits: true },
    });

    if (!user || user.credits <= 0) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Insufficient credits. Please upgrade your plan." },
          { status: 402 }
        )
      );
    }

    // Deduct credit immediately
    await prisma.user.update({
      where: { id: authPayload.sub },
      data: { credits: { decrement: 1 } },
    });

    // Create job record
    const jobRecord = await prisma.analysisJob.create({
      data: {
        userId: authPayload.sub,
        status: "QUEUED",
        progress: 0,
        inputText: text, // Store encrypted or hashed if needed
        customPrompt: customPrompt || "",
      },
    });

    // Queue job for external worker
    await addAnalysisJob(
      {
        userId: authPayload.sub,
        text,
        customPrompt: customPrompt || "",
        jobId: jobRecord.id,
      },
      {
        jobId: jobRecord.id,
        priority: 5,
      }
    );

    return applySecurityHeaders(
      NextResponse.json({
        jobId: jobRecord.id,
        status: "QUEUED",
        message: "Analysis job queued. Poll /api/jobs/{id}/status for updates.",
      }, { status: 202 })
    );
  } catch (error) {
    log.error("Error queuing analysis job", error, { userId: authPayload?.sub });
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Server error", details: error.message },
        { status: 500 }
      )
    );
  }
}

