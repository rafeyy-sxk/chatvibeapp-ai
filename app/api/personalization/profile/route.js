import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getUserProfile, getEmotionalTrendline } from "@/lib/personalization/userModeling";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request) {
  try {
    const authPayload = verifyAccessToken(request);
    if (!authPayload) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const userId = authPayload.sub;

    // Get user profile
    const profile = await getUserProfile(userId);

    if (!profile) {
      return applySecurityHeaders(
        NextResponse.json({ 
          error: "Profile not found",
          message: "User profile will be created after first analysis"
        }, { status: 404 })
      );
    }

    // Get emotional trendline (last 30 days)
    const trendline = await getEmotionalTrendline(userId, 30);

    return applySecurityHeaders(
      NextResponse.json({
        profile: {
          personalityTraits: profile.personalityTraits,
          communicationStyle: profile.communicationStyle,
          consistencyScore: profile.consistencyScore,
          emotionalBaseline: profile.emotionalBaseline,
          analysisCount: profile.analysisCount,
          lastUpdated: profile.lastUpdated,
        },
        trendline,
      })
    );
  } catch (error) {
    log.error("Error fetching user profile", error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}

