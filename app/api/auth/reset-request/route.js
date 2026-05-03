import crypto from "crypto";
import prisma from "@/lib/prisma";
import { resetRequestSchema } from "@/lib/validation/authSchemas";
import { enforceRateLimit } from "@/middleware/rateLimit";
import { validateCsrf, ensureCsrfCookie } from "@/middleware/csrf";
import { errorResponse, jsonResponse } from "@/lib/http";
import { sendPasswordResetEmail } from "@/lib/email";
import { addMinutes } from "date-fns";
import { applySecurityHeaders } from "@/lib/security/headers";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request) {
  const rateLimit = await enforceRateLimit(request, "auth:reset-request");
  if (rateLimit) return rateLimit;

  const csrfCheck = validateCsrf(request);
  if (csrfCheck) return csrfCheck;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const parsed = resetRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse("Invalid input", 422);
  }

  const { usernameOrEmail } = parsed.data;
  const user =
    (await prisma.user.findUnique({ where: { username: usernameOrEmail } })) ||
    (await prisma.user.findUnique({ where: { email: usernameOrEmail } }));

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpiry: addMinutes(new Date(), 30),
      },
    });
    await sendPasswordResetEmail({ to: user.email || user.username, token });
  }

  const response = jsonResponse({ success: true });
  ensureCsrfCookie(response, request.cookies.get("cv_csrf")?.value);
  return applySecurityHeaders(response);
}

