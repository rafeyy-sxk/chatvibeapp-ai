/**
 * GET /api/billing/portal - Get Stripe customer portal session
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { stripe } from "@/lib/billing/stripe";
import { getCustomerByUserId } from "@/lib/billing/customer";
import { getCorrelationId } from "@/lib/logger";
import { log } from "@/lib/logger";
import prisma from "@/lib/prisma";

// Ensure Node.js runtime for Prisma and Stripe
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

    // Get or create customer
    let customer = await getCustomerByUserId(authPayload.sub);
    if (!customer) {
      // Create customer for free tier user
      const user = await prisma.user.findUnique({
        where: { id: authPayload.sub },
        select: { email: true, username: true },
      });

      if (!user) {
        return applySecurityHeaders(
          NextResponse.json({ error: "User not found" }, { status: 404 })
        );
      }

      customer = await prisma.billingCustomer.create({
        data: {
          userId: authPayload.sub,
          stripeCustomerId: null,
          email: user.email || null,
          name: user.username || null,
        },
      });
    }

    if (!stripe) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Billing not configured" }, { status: 503 })
      );
    }

    // Free tier users without Stripe customer can't access portal
    if (!customer.stripeCustomerId) {
      return applySecurityHeaders(
        NextResponse.json({ 
          error: "No active subscription. Please subscribe to access the customer portal.",
          upgradeRequired: true,
        }, { status: 403 })
      );
    }

    // Create portal session
    const { searchParams } = new URL(request.url);
    const returnUrl = searchParams.get("return_url") || `${process.env.FRONTEND_ORIGIN || "http://localhost:3000"}/billing`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: returnUrl,
    });

    return applySecurityHeaders(
      NextResponse.json({ url: session.url })
    );
  } catch (error) {
    log.error("Error creating portal session", error, { correlationId });
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

