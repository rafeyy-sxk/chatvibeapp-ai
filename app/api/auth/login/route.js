import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/authSchemas";
import { verifyPassword } from "@/lib/security/password";
import { enforceRateLimit } from "@/middleware/rateLimit";
import { validateCsrf, ensureCsrfCookie } from "@/middleware/csrf";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/tokens";
import { persistRefreshToken, revokeRefreshToken } from "@/lib/auth/refreshStore";
import { setRefreshCookie } from "@/lib/auth/cookies";
import { jsonResponse, errorResponse } from "@/lib/http";
import { applySecurityHeaders } from "@/lib/security/headers";
import { isLocked, registerFailedLogin, resetFailedLogins } from "@/lib/auth/lockout";
import { createUserSession } from "@/lib/security/sessionManager";
import { getCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request) {
  const correlationId = getCorrelationId(request);
  try {
  const rateLimit = await enforceRateLimit(request, "auth:login");
  if (rateLimit) return rateLimit;

  const csrfCheck = validateCsrf(request);
  if (csrfCheck) return csrfCheck;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse("Invalid input", 422);
  }

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return errorResponse("Invalid credentials", 401);
  }

  if (isLocked(user)) {
    return errorResponse("Account temporarily locked due to failed attempts. Try again later.", 423);
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    await registerFailedLogin(user.id);
    return errorResponse("Invalid credentials", 401);
  }

  await resetFailedLogins(user.id);

  const accessToken = generateAccessToken({ sub: user.id, username: user.username });
  const refreshToken = generateRefreshToken({ sub: user.id });
  const refreshTokenRecord = await persistRefreshToken({ userId: user.id, token: refreshToken });

  // Update user last login info
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: clientIp,
      lastLoginUserAgent: userAgent,
    },
  });

  // Create session with device tracking
  const { session, suspicious, deviceInfo } = await createUserSession(
    user.id,
    refreshTokenRecord.id,
    request
  );

  const response = jsonResponse({
    user: { id: user.id, username: user.username },
    accessToken,
    suspiciousLogin: suspicious,
    deviceInfo,
  });
  setRefreshCookie(response, refreshToken);
  ensureCsrfCookie(response, request.cookies.get("cv_csrf")?.value);
  return applySecurityHeaders(response);
  } catch (error) {
    console.error("[login] Error:", error.message);
    return applySecurityHeaders(
      NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 })
    );
  }
}

