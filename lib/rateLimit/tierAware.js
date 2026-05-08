import { NextResponse } from "next/server";
import { enforceRateLimit } from "../rateLimit";
import { detectAbuse } from "./abuseDetection";

const RATE_LIMITS = {
  analyze: { limit: 10, windowSeconds: 60 },
  reports: { limit: 60, windowSeconds: 60 },
};

export async function enforceTierRateLimit(request, endpoint, userId) {
  const limits = RATE_LIMITS[endpoint] ?? { limit: 30, windowSeconds: 60 };

  const abuseResult = await detectAbuse(request, userId);
  if (abuseResult.blocked) {
    const retryAfter = abuseResult.retryAfter || 300;
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  return await enforceRateLimit(request, {
    limit: limits.limit,
    windowSeconds: limits.windowSeconds,
    keyPrefix: endpoint,
    userId,
  });
}
