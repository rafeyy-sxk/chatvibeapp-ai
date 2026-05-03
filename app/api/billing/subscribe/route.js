/**
 * POST /api/billing/subscribe - Create or update subscription
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { createSubscription } from "@/lib/billing/subscription";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { getTierConfig } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { getCorrelationId } from "@/lib/logger";
import { log } from "@/lib/logger";
import { z } from "zod";

// Ensure Node.js runtime for Prisma and Stripe
export const runtime = 'nodejs';
export const maxDuration = 30;

const subscribeSchema = z.object({
  tier: z.enum(["BASIC", "PRO"]),
  paymentMethodId: z.string().optional(),
});

export async function POST(request) {
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

    // Parse and validate
    const body = await request.json();
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid request", details: validation.error.flatten() },
          { status: 400 }
        )
      );
    }

    const { tier, paymentMethodId } = validation.data;

    // Check if payments are enabled (gate for regions where Stripe live is unavailable)
    if (!env.paymentsEnabled) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            error: "Payments are currently unavailable in your region",
            message: "We're working on enabling payments. Please check back soon!",
            paymentsEnabled: false,
          },
          { status: 503 }
        )
      );
    }

    // If payment method provided, create subscription directly
    // Otherwise, create checkout session
    if (paymentMethodId) {
      const subscription = await createSubscription(authPayload.sub, tier, paymentMethodId);
      return applySecurityHeaders(
        NextResponse.json({
          subscriptionId: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          monthlyCredits: subscription.monthlyCredits,
          currentPeriodEnd: subscription.currentPeriodEnd,
        })
      );
    } else {
      // Create checkout session
      const { searchParams } = new URL(request.url);
      const successUrl = searchParams.get("success_url") || `${process.env.FRONTEND_ORIGIN || "http://localhost:3000"}/billing?success=true`;
      const cancelUrl = searchParams.get("cancel_url") || `${process.env.FRONTEND_ORIGIN || "http://localhost:3000"}/billing?canceled=true`;

      const session = await createCheckoutSession(authPayload.sub, tier, successUrl, cancelUrl);

      return applySecurityHeaders(
        NextResponse.json({
          checkoutUrl: session.url,
          sessionId: session.id,
        })
      );
    }
  } catch (error) {
    log.error("Error creating subscription", error, { correlationId });
    return applySecurityHeaders(
      NextResponse.json(
        {
          error: "Failed to create subscription",
          message: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      )
    );
  }
}

