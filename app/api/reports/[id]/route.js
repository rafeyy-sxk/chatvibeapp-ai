import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { enforceRateLimit } from "@/lib/rateLimit";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

function ensureAuthorized(request) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) {
    return { error: "Unauthorized request", status: 403 };
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return { error: "Unauthorized request", status: 403 };
  }

  try {
    const payload = verifyAccessToken(token);
    return { payload };
  } catch {
    return { error: "Invalid or expired access token", status: 401 };
  }
}

export async function GET(request, { params }) {
  // ⚡ Rate limiting - MUST be first
  const auth = ensureAuthorized(request);
  
  const rateLimitResponse = await enforceRateLimit(request, {
    limit: 30,
    windowSeconds: 60,
    keyPrefix: "reports",
    userId: auth.payload?.sub,
  });
  if (rateLimitResponse) {
    return applySecurityHeaders(rateLimitResponse);
  }
  
  if (auth.error) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    return applySecurityHeaders(res);
  }

  const { id } = params;

  // Try cache first
  const { getCachedAnalysisResult, setCachedAnalysisResult } = await import('@/lib/cache/analysisCache');
  let report = await getCachedAnalysisResult(id);

  if (!report) {
    // Cache miss - fetch from database
    const dbReport = await prisma.analysisReport.findFirst({
      where: { id, userId: auth.payload.sub },
      include: { job: { select: { vibe: true } } },
    });

    if (!dbReport) {
      const res = NextResponse.json({ error: "Report not found" }, { status: 404 });
      return applySecurityHeaders(res);
    }

    report = {
      id: dbReport.id,
      createdAt: dbReport.createdAt,
      rawText: dbReport.rawText,
      analytics: dbReport.analyticsJson,
      geminiSummary: dbReport.geminiSummary,
      vibe: dbReport.job?.vibe ?? null,
    };

    // Cache the result
    await setCachedAnalysisResult(id, report);
  }

  const res = NextResponse.json(report);
  return applySecurityHeaders(res);
}


