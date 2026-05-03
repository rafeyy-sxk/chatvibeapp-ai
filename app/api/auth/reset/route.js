import crypto from "crypto";
import prisma from "@/lib/prisma";
import { resetSchema } from "@/lib/validation/authSchemas";
import { enforceRateLimit } from "@/middleware/rateLimit";
import { validateCsrf, ensureCsrfCookie } from "@/middleware/csrf";
import { errorResponse, jsonResponse } from "@/lib/http";
import { hashPassword } from "@/lib/security/password";
import { applySecurityHeaders } from "@/lib/security/headers";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request) {
  const rateLimit = await enforceRateLimit(request, "auth:reset");
  if (rateLimit) return rateLimit;

  const csrfCheck = validateCsrf(request);
  if (csrfCheck) return csrfCheck;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const parsed = resetSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse("Invalid input", 422);
  }

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: tokenHash,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return errorResponse("Invalid or expired token", 400);
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  });

  const response = jsonResponse({ success: true });
  ensureCsrfCookie(response, request.cookies.get("cv_csrf")?.value);
  return applySecurityHeaders(response);
}

