import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { findSimilarToAnalysis, findSimilarToText } from "@/lib/personalization/similaritySearch";
import { z } from "zod";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

const similarSchema = z.object({
  analysisReportId: z.string().optional(),
  text: z.string().optional(),
  limit: z.number().min(1).max(20).optional().default(10),
  minSimilarity: z.number().min(0).max(1).optional().default(0.7),
});

export async function POST(request) {
  try {
    const authPayload = verifyAccessToken(request);
    if (!authPayload) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const userId = authPayload.sub;
    const body = await request.json();

    // Validate input
    const parsed = similarSchema.safeParse(body);
    if (!parsed.success) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid input", details: parsed.error.errors },
          { status: 422 }
        )
      );
    }

    const { analysisReportId, text, limit, minSimilarity } = parsed.data;

    // Must provide either analysisReportId or text
    if (!analysisReportId && !text) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Must provide either analysisReportId or text" },
          { status: 422 }
        )
      );
    }

    // Find similar analyses
    let similar;
    if (analysisReportId) {
      similar = await findSimilarToAnalysis(userId, analysisReportId, limit);
    } else {
      similar = await findSimilarToText(userId, text, limit);
    }

    // Filter by minimum similarity
    const filtered = similar.filter(s => s.similarity >= minSimilarity);

    return applySecurityHeaders(
      NextResponse.json({
        similar: filtered.map(s => ({
          analysisReportId: s.analysisReportId,
          similarity: s.similarity,
          textPreview: s.textChunk,
          createdAt: s.analysisReport.createdAt,
        })),
        count: filtered.length,
      })
    );
  } catch (error) {
    log.error("Error finding similar analyses", error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}

