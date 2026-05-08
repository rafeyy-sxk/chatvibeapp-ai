/**
 * GET /api/history?page=1&limit=20&search=term
 * Returns paginated analysis history with optional full-text search.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
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

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10));
  const search = searchParams.get("search")?.trim() || "";
  const skip = (page - 1) * limit;

  try {
    const where = {
      userId,
      ...(search
        ? {
            OR: [
              { inputText: { contains: search, mode: "insensitive" } },
              { customPrompt: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.analysisJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          progress: true,
          createdAt: true,
          customPrompt: true,
          inputText: true,
          // result omitted — fetch via /api/jobs/[id]/results for detail view
        },
      }),
      prisma.analysisJob.count({ where }),
    ]);

    return applySecurityHeaders(
      NextResponse.json({
        data: {
          jobs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            hasNext: skip + limit < total,
          },
        },
        status: "ok",
        error: null,
      })
    );
  } catch (err) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Failed to fetch history", status: "error", data: null },
        { status: 500 }
      )
    );
  }
}

/** DELETE /api/history?jobId=X — remove a single job from history */
export async function DELETE(request) {
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

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Missing jobId", status: "error", data: null }, { status: 400 })
    );
  }

  const deleted = await prisma.analysisJob
    .deleteMany({ where: { id: jobId, userId } })
    .catch(() => null);

  return applySecurityHeaders(
    NextResponse.json({ data: { deleted: deleted?.count ?? 0 }, status: "ok", error: null })
  );
}
