import { enforceRateLimit } from "@/middleware/rateLimit";
import { validateCsrf, ensureCsrfCookie } from "@/middleware/csrf";
import { errorResponse, jsonResponse } from "@/lib/http";
import { findValidRefreshToken, persistRefreshToken } from "@/lib/auth/refreshStore";
import { clearRefreshCookie, setRefreshCookie } from "@/lib/auth/cookies";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/lib/auth/tokens";
import prisma from "@/lib/prisma";
import { applySecurityHeaders } from "@/lib/security/headers";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request) {
  const rateLimit = await enforceRateLimit(request, "auth:refresh");
  if (rateLimit) return rateLimit;

  const csrfCheck = validateCsrf(request);
  if (csrfCheck) return csrfCheck;

  const refreshToken = request.cookies.get("cv_refresh")?.value;
  if (!refreshToken) {
    return errorResponse("Missing refresh token", 401);
  }

  try {
    await findValidRefreshTokenOrThrow(refreshToken);
  } catch (err) {
    const response = errorResponse("Invalid refresh token", 401);
    clearRefreshCookie(response);
    return response;
  }

  const payload = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    const response = errorResponse("User not found", 401);
    clearRefreshCookie(response);
    return response;
  }

  const newAccessToken = generateAccessToken({ sub: user.id, username: user.username });
  const newRefreshToken = generateRefreshToken({ sub: user.id });
  await persistRefreshToken({ userId: user.id, token: newRefreshToken });

  const response = jsonResponse({ accessToken: newAccessToken });
  setRefreshCookie(response, newRefreshToken);
  ensureCsrfCookie(response, request.cookies.get("cv_csrf")?.value);
  return applySecurityHeaders(response);
}

async function findValidRefreshTokenOrThrow(token) {
  const record = await findValidRefreshToken(token);
  if (!record) {
    throw new Error("invalid_refresh");
  }
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revoked: true },
  });
  return record;
}

