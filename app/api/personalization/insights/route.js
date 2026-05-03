import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getUserProfile, getEmotionalTrendline } from "@/lib/personalization/userModeling";
import { getFeedbackStats, getImprovementScore } from "@/lib/personalization/feedbackLoop";
import prisma from "@/lib/prisma";
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
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    // Get user profile
    const profile = await getUserProfile(userId);

    // Get emotional trendline
    const trendline = await getEmotionalTrendline(userId, days);

    // Get feedback statistics
    const feedbackStats = await getFeedbackStats(userId);

    // Get improvement score
    const improvementScore = await getImprovementScore(userId, days);

    // Get recent analyses count
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentAnalysesCount = await prisma.analysisReport.count({
      where: {
        userId,
        createdAt: { gte: cutoffDate },
      },
    });

    // Calculate insights
    const insights = {
      profile: profile ? {
        personalityTraits: profile.personalityTraits,
        communicationStyle: profile.communicationStyle,
        consistencyScore: profile.consistencyScore,
      } : null,
      trendline,
      feedbackStats,
      improvementScore,
      recentAnalysesCount,
      patterns: calculatePatterns(trendline, profile),
    };

    return applySecurityHeaders(
      NextResponse.json(insights)
    );
  } catch (error) {
    log.error("Error fetching insights", error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}

/**
 * Calculate patterns from trendline and profile
 */
function calculatePatterns(trendline, profile) {
  if (trendline.length < 2) {
    return {
      emotionalStability: "insufficient_data",
      trendDirection: "insufficient_data",
    };
  }

  // Calculate emotional stability
  const variances = ['flirty', 'angry', 'friendly', 'romantic'].map(metric => {
    const values = trendline.map(t => t[metric] || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  });

  const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
  const emotionalStability = avgVariance < 100 ? "stable" : avgVariance < 300 ? "moderate" : "volatile";

  // Calculate trend direction
  const recent = trendline.slice(-5);
  const older = trendline.slice(0, 5);
  
  const recentAvg = recent.reduce((sum, t) => sum + (t.friendly || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, t) => sum + (t.friendly || 0), 0) / older.length;
  
  const trendDirection = recentAvg > olderAvg + 10 ? "improving" : 
                         recentAvg < olderAvg - 10 ? "declining" : "stable";

  return {
    emotionalStability,
    trendDirection,
    consistencyScore: profile?.consistencyScore || 0.5,
  };
}

