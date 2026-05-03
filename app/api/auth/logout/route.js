import { enforceRateLimit } from "@/middleware/rateLimit";
import { validateCsrf, ensureCsrfCookie } from "@/middleware/csrf";
import { revokeRefreshToken } from "@/lib/auth/refreshStore";
import { clearRefreshCookie } from "@/lib/auth/cookies";
import { jsonResponse } from "@/lib/http";
import { applySecurityHeaders } from "@/lib/security/headers";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request) {
  const rateLimit = await enforceRateLimit(request, "auth:logout");
  if (rateLimit) return rateLimit;

  const csrfCheck = validateCsrf(request);
  if (csrfCheck) return csrfCheck;

  const refreshToken = request.cookies.get("cv_refresh")?.value;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  const response = jsonResponse({ success: true });
  clearRefreshCookie(response);
  ensureCsrfCookie(response, request.cookies.get("cv_csrf")?.value);
  return applySecurityHeaders(response);
}

