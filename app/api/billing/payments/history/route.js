/**
 * GET /api/billing/payments/history - Get payment history
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { stripe } from "@/lib/billing/stripe";
import { getCustomerByUserId } from "@/lib/billing/customer";
import { getCorrelationId } from "@/lib/logger";
import { log } from "@/lib/logger";

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

    // Get customer
    let customer = await getCustomerByUserId(authPayload.sub);
    if (!customer) {
      return applySecurityHeaders(
        NextResponse.json({ payments: [] })
      );
    }

    if (!stripe) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Billing not configured" }, { status: 503 })
      );
    }

    // Free tier users without Stripe customer have no payment history
    if (!customer.stripeCustomerId) {
      return applySecurityHeaders(
        NextResponse.json({ payments: [] })
      );
    }

    // Get invoices from Stripe
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const invoices = await stripe.invoices.list({
      customer: customer.stripeCustomerId,
      limit: Math.min(limit, 100),
      expand: ["data.payment_intent"],
    });

    const payments = invoices.data.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount_paid / 100, // Convert cents to dollars
      currency: invoice.currency,
      status: invoice.status,
      paidAt: invoice.status_transitions.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      invoiceUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf,
    }));

    return applySecurityHeaders(
      NextResponse.json({ payments })
    );
  } catch (error) {
    log.error("Error getting payment history", error, { correlationId });
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

