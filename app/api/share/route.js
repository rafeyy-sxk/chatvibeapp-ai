/**
 * POST /api/share — create a shareable public link for an analysis result
 * GET  /api/share/[token] — public read of a shared result (no auth required)
 *
 * TODO: Add shareToken column to AnalysisJob in prisma/schema.prisma:
 *   shareToken  String?  @unique
 *   isPublic    Boolean  @default(false)
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

/** POST /api/share — generate or revoke a share token */
export async function POST(request) {
  let userId;
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) throw new Error("No token");
    userId = verifyAccessToken(token).sub;
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
      NextResponse.json({ error: "Invalid JSON", status: "error", data: null }, { status: 400 })
    );
  }

  const { jobId, public: makePublic = true } = body;

  if (!jobId) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Missing jobId", status: "error", data: null }, { status: 400 })
    );
  }

  const job = await prisma.analysisJob.findFirst({
    where: { id: jobId, userId, status: "COMPLETED" },
  }).catch(() => null);

  if (!job) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Completed job not found", status: "error", data: null },
        { status: 404 }
      )
    );
  }

  if (!makePublic) {
    // Revoke sharing
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        // @ts-ignore — shareToken added via migration TODO above
        isPublic: false,
        shareToken: null,
      },
    }).catch(() => null);

    return applySecurityHeaders(
      NextResponse.json({ data: { shared: false }, status: "ok", error: null })
    );
  }

  // Generate or reuse existing share token
  const shareToken =
    // @ts-ignore
    job.shareToken || randomBytes(16).toString("hex");

  await prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      // @ts-ignore
      isPublic: true,
      shareToken,
    },
  }).catch(() => null);

  const shareUrl = `/share/${shareToken}`;

  return applySecurityHeaders(
    NextResponse.json({
      data: { shareToken, shareUrl, jobId },
      status: "ok",
      error: null,
    })
  );
}

/** GET /api/share?token=X — fetch a publicly shared result (no auth) */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Missing token", status: "error", data: null }, { status: 400 })
    );
  }

  const job = await prisma.analysisJob.findFirst({
    where: {
      // @ts-ignore
      shareToken: token,
      isPublic: true,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      result: true,
    },
  }).catch(() => null);

  if (!job) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Shared result not found", status: "error", data: null }, { status: 404 })
    );
  }

  return applySecurityHeaders(
    NextResponse.json({ data: job, status: "ok", error: null })
  );
}
