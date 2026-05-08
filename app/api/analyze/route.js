import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractUserFromRequest } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { log } from "@/lib/logger";
import { enforceTierRateLimit } from "@/lib/rateLimit/tierAware";
import { recordFailedRequest } from "@/lib/rateLimit/abuseDetection";
import { addAnalysisJob } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request) {
  let authPayload = null;
  try {
    authPayload = extractUserFromRequest(request);
    if (!authPayload) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const rateLimitResponse = await enforceTierRateLimit(request, "analyze", authPayload.sub);
    if (rateLimitResponse) {
      await recordFailedRequest(request, authPayload.sub);
      return applySecurityHeaders(rateLimitResponse);
    }

    const body = await request.json();
    const { text, customPrompt } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return applySecurityHeaders(
        NextResponse.json({ error: "No text provided." }, { status: 400 })
      );
    }

    if (text.length > 10 * 1024 * 1024) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Text too large. Maximum 10MB allowed." }, { status: 400 })
      );
    }

    const jobRecord = await prisma.analysisJob.create({
      data: {
        userId: authPayload.sub,
        status: "QUEUED",
        progress: 0,
        inputText: text,
        customPrompt: customPrompt || "",
      },
    });

    await addAnalysisJob(
      { userId: authPayload.sub, text, customPrompt: customPrompt || "", jobId: jobRecord.id },
      { jobId: jobRecord.id, priority: 5 }
    );

    return applySecurityHeaders(
      NextResponse.json(
        { jobId: jobRecord.id, status: "QUEUED", message: "Analysis queued." },
        { status: 202 }
      )
    );
  } catch (error) {
    log.error("Error queuing analysis job", error, { userId: authPayload?.sub });
    return applySecurityHeaders(
      NextResponse.json({ error: "Server error" }, { status: 500 })
    );
  }
}
