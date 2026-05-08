import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { addAnalysisJob } from "@/lib/queue";
import prisma from "@/lib/prisma";
import { log, getCorrelationId, createLogger } from "@/lib/logger";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const createJobSchema = z.object({
  images: z.array(z.string()).min(1).max(10),
  customPrompt: z.string().optional(),
});

export async function POST(request) {
  const correlationId = getCorrelationId(request);
  const logger = createLogger(correlationId);

  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    let authPayload;
    try {
      authPayload = verifyAccessToken(token);
    } catch {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
      );
    }

    const body = await request.json();
    const validation = createJobSchema.safeParse(body);
    if (!validation.success) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 })
      );
    }

    const { images, customPrompt } = validation.data;

    const jobRecord = await prisma.analysisJob.create({
      data: {
        userId: authPayload.sub,
        status: "QUEUED",
        progress: 0,
        imageCount: images.length,
        priority: 5,
        customPrompt: customPrompt || null,
      },
    });

    const job = await addAnalysisJob(
      { userId: authPayload.sub, images, customPrompt: customPrompt || "", jobId: jobRecord.id },
      { jobId: jobRecord.id, priority: 5 }
    );

    logger.info("Analysis job created", { jobId: jobRecord.id, userId: authPayload.sub });

    return applySecurityHeaders(
      NextResponse.json(
        { jobId: jobRecord.id, status: "QUEUED", progress: 0, createdAt: jobRecord.createdAt },
        { status: 201 }
      )
    );
  } catch (error) {
    log.error("Error creating job", error, { correlationId });
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Internal server error", message: process.env.NODE_ENV === "development" ? error.message : undefined },
        { status: 500 }
      )
    );
  }
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    let authPayload;
    try {
      authPayload = verifyAccessToken(authHeader.slice(7));
    } catch {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid token" }, { status: 401 }));
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);
    const offset = Number(searchParams.get("offset") || "0");

    const jobs = await prisma.analysisJob.findMany({
      where: { userId: authPayload.sub },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        status: true,
        progress: true,
        imageCount: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    return applySecurityHeaders(NextResponse.json({ jobs }));
  } catch (error) {
    log.error("Error fetching jobs", error);
    return applySecurityHeaders(NextResponse.json({ error: "Server error" }, { status: 500 }));
  }
}
