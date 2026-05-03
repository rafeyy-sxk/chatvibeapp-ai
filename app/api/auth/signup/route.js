import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signupSchema } from "@/lib/validation/authSchemas";
import { hashPassword } from "@/lib/security/password";
import { enforceRateLimit } from "@/middleware/rateLimit";
import { ensureCsrfCookie } from "@/middleware/csrf";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/tokens";
import { persistRefreshToken } from "@/lib/auth/refreshStore";
import { setRefreshCookie } from "@/lib/auth/cookies";
import { jsonResponse, errorResponse } from "@/lib/http";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request) {
  try {
    const rateLimit = await enforceRateLimit(request, "auth:signup");
    if (rateLimit) return rateLimit;

    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    const parsed = signupSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse("Invalid input", 422, { details: parsed.error.flatten() });
    }

    const { username, email, password } = parsed.data;

    const orConditions = [{ username }];
    if (email) orConditions.push({ email });

    const existing = await prisma.user.findFirst({ where: { OR: orConditions } });
    if (existing) {
      return errorResponse("Username or email already taken", 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, email: email || null, passwordHash },
    });

    const accessToken = generateAccessToken({ sub: user.id, username: user.username });
    const refreshToken = generateRefreshToken({ sub: user.id });
    await persistRefreshToken({ userId: user.id, token: refreshToken });

    const response = jsonResponse({
      user: { id: user.id, username: user.username, email: user.email },
      accessToken,
    });
    setRefreshCookie(response, refreshToken);
    ensureCsrfCookie(response, request.cookies.get("cv_csrf")?.value);
    return applySecurityHeaders(response);
  } catch (error) {
    console.error("[signup] Error:", error.message);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Signup failed. Please try again." },
        { status: 500 }
      )
    );
  }
}
