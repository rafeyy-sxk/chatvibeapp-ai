/**
 * GET /api/billing/status - Get payments status
 * Returns whether payments are enabled (for frontend UX)
 * Backend still enforces this check in subscribe route
 */

import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { env } from "@/lib/env";

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  return applySecurityHeaders(
    NextResponse.json({
      paymentsEnabled: env.paymentsEnabled,
      message: env.paymentsEnabled
        ? "Payments are enabled"
        : "Payments are currently unavailable. We're working on enabling them soon!",
    })
  );
}
