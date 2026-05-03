import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { enforceTierRateLimit } from "@/lib/rateLimit/tierAware";
import { recordFailedRequest } from "@/lib/rateLimit/abuseDetection";

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

export async function GET(request) {
  // ⚡ Tier-aware rate limiting - MUST be first
  const auth = ensureAuthorized(request);
  
  if (auth.error) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    return applySecurityHeaders(res);
  }

  const rateLimitResponse = await enforceTierRateLimit(
    request,
    "reports",
    auth.payload.sub
  );
  
  if (rateLimitResponse) {
    await recordFailedRequest(request, auth.payload.sub);
    return applySecurityHeaders(rateLimitResponse);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);

  const reports = await prisma.analysisReport.findMany({
    where: { userId: auth.payload.sub },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      analyticsJson: true,
      geminiSummary: true,
    },
  });

  const res = NextResponse.json({ reports });
  return applySecurityHeaders(res);
}


