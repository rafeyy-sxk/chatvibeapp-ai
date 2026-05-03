/**
 * GET /api/billing/usage - Get usage statistics
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getUsageStats, getCreditBalance } from "@/lib/billing/usage";
import { getUserSubscription, getUserTier } from "@/lib/billing/subscription";
import { getTierConfig } from "@/lib/billing/stripe";
import { getCorrelationId } from "@/lib/logger";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request) {
  const correlationId = getCorrelationId(request);

  try {
    // Authentication
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    let authPayload;
    try {
      authPayload = verifyAccessToken(token);
    } catch (error) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
      );
    }

    // Get subscription
    const subscription = await getUserSubscription(authPayload.sub);
    const tier = await getUserTier(authPayload.sub);
    const tierConfig = getTierConfig(tier);

    // Calculate period
    const now = new Date();
    let periodStart, periodEnd;

    if (subscription) {
      periodStart = subscription.currentPeriodStart;
      periodEnd = subscription.currentPeriodEnd;
    } else {
      // Free tier: use calendar month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Get usage stats
    const usage = await getUsageStats(authPayload.sub, periodStart, periodEnd);
    const creditsRemaining = await getCreditBalance(authPayload.sub);

    return applySecurityHeaders(
      NextResponse.json({
        tier,
        tierName: tierConfig.name,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            }
          : null,
        usage: {
          ...usage,
          creditsRemaining,
          monthlyAllowance: tierConfig.monthlyCredits,
          periodStart,
          periodEnd,
        },
      })
    );
  } catch (error) {
    log.error("Error getting usage", error, { correlationId });
    return applySecurityHeaders(
      NextResponse.json(
        {
          error: "Internal server error",
          message: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      )
    );
  }
}

