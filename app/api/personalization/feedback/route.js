import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { recordFeedback } from "@/lib/personalization/feedbackLoop";
import { z } from "zod";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

const feedbackSchema = z.object({
  analysisReportId: z.string(),
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().optional(),
  wasHelpful: z.boolean().optional(),
  adviceType: z.enum(["RELATIONSHIP", "COMMUNICATION", "EMOTIONAL", "BEHAVIORAL", "GENERAL"]).optional(),
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
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid input", details: parsed.error.errors },
          { status: 422 }
        )
      );
    }

    const { analysisReportId, rating, comment, wasHelpful, adviceType } = parsed.data;

    // Record feedback
    const feedback = await recordFeedback(userId, analysisReportId, {
      rating,
      comment,
      wasHelpful,
      adviceType: adviceType || "GENERAL",
    });

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        feedback: {
          id: feedback.id,
          rating: feedback.userRating,
          wasHelpful: feedback.wasHelpful,
          modelAdjustment: feedback.modelAdjustment,
        },
      })
    );
  } catch (error) {
    log.error("Error recording feedback", error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}

