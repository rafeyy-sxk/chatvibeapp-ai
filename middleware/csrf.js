import crypto from "crypto";
import { NextResponse } from "next/server";

const CSRF_COOKIE = "cv_csrf";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

export function ensureCsrfCookie(response, existingToken) {
  if (existingToken) return;
  const token = crypto.randomBytes(32).toString("hex");
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 60 * 60,
  });
}

export function validateCsrf(request) {
  if (SAFE_METHODS.includes(request.method)) return null;
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  return null;
}

