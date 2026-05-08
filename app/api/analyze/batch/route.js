/**
 * POST /api/analyze/batch
 * Queue up to 10 images for parallel AI analysis.
 * Returns an array of jobIds. Poll /api/jobs/[id]/status for each.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { addAnalysisJob } from "@/lib/queue";
import { applySecurityHeaders } from "@/lib/security/headers";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_BATCH = 10;

export async function POST(request) {
  let userId;
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) throw new Error("No token");
    const payload = verifyAccessToken(token);
    userId = payload.sub;
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized", status: "error", data: null }, { status: 401 })
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Invalid JSON body", status: "error", data: null },
        { status: 400 }
      )
    );
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "items must be a non-empty array", status: "error", data: null },
        { status: 400 }
      )
    );
  }

  if (items.length > MAX_BATCH) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: `Maximum ${MAX_BATCH} images per batch`, status: "error", data: null },
        { status: 400 }
      )
    );
  }

  // Validate each item
  for (const item of items) {
    if (!item.text || typeof item.text !== "string") {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Each item must have a non-empty text field", status: "error", data: null },
          { status: 400 }
        )
      );
    }
  }

  try {
    // Create all DB records in parallel, then enqueue all jobs in parallel
    const jobRecords = await Promise.all(
      items.map((item) =>
        prisma.analysisJob.create({
          data: {
            userId,
            status: "QUEUED",
            progress: 0,
            inputText: item.text,
            customPrompt: item.customPrompt || "",
          },
        })
      )
    );

    await Promise.all(
      jobRecords.map((jobRecord, i) =>
        addAnalysisJob(
          { userId, text: items[i].text, customPrompt: items[i].customPrompt || "", jobId: jobRecord.id },
          { jobId: jobRecord.id, priority: 5 }
        )
      )
    );

    const jobIds = jobRecords.map((j) => j.id);

    return applySecurityHeaders(
      NextResponse.json(
        {
          data: { jobIds, count: jobIds.length },
          status: "ok",
          error: null,
          message: `${jobIds.length} jobs queued. Poll /api/jobs/[id]/status for updates.`,
        },
        { status: 202 }
      )
    );
  } catch (err) {
    log.error("Batch analyze error", err, { userId });
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Failed to queue batch", status: "error", data: null },
        { status: 500 }
      )
    );
  }
}
