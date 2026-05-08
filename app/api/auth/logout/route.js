import { enforceRateLimit } from "@/middleware/rateLimit";
import { revokeRefreshToken } from "@/lib/auth/refreshStore";
import { clearRefreshCookie } from "@/lib/auth/cookies";
import { jsonResponse } from "@/lib/http";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request) {
  const rateLimit = await enforceRateLimit(request, "auth:logout");
  if (rateLimit) return rateLimit;

  const refreshToken = request.cookies.get("cv_refresh")?.value;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  const response = jsonResponse({ success: true });
  clearRefreshCookie(response);
  return applySecurityHeaders(response);
}

