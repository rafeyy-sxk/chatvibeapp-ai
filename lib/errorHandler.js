/**
 * Centralized Error Handling
 * Production-grade error handling with proper logging and user-safe responses
 */

import { log, getCorrelationId } from "./logger";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "./security/headers";

/**
 * Handle API route errors consistently
 * Logs errors, sends to Sentry, returns safe error response
 */
export function handleApiError(error, request, context = {}) {
  const correlationId = getCorrelationId(request);
  
  // Log error with full context
  log.error("API route error", error, {
    correlationId,
    route: context.route || "unknown",
    ...context,
  });

  // Determine error type and status
  let status = 500;
  let message = "Internal server error";
  let details = null;

  if (error.name === "ValidationError" || error.name === "ZodError") {
    status = 400;
    message = "Invalid request";
    details = error.errors || error.issues;
  } else if (error.name === "UnauthorizedError" || error.message?.includes("Unauthorized")) {
    status = 401;
    message = "Unauthorized";
  } else if (error.name === "ForbiddenError" || error.message?.includes("Forbidden")) {
    status = 403;
    message = "Forbidden";
  } else if (error.message?.includes("Not Found")) {
    status = 404;
    message = "Not found";
  } else if (error.message?.includes("Rate limit")) {
    status = 429;
    message = "Too many requests";
  } else if (error.message?.includes("subscription") || error.message?.includes("payment")) {
    status = 402;
    message = error.message || "Payment required";
  } else {
    // Generic server error - don't expose details in production
    message = process.env.NODE_ENV === "development" 
      ? error.message 
      : "Internal server error";
    
    if (process.env.NODE_ENV === "development") {
      details = {
        stack: error.stack,
        name: error.name,
      };
    }
  }

  return applySecurityHeaders(
    NextResponse.json(
      {
        error: message,
        ...(details && { details }),
        ...(process.env.NODE_ENV === "development" && { correlationId }),
      },
      { status }
    )
  );
}

/**
 * Wrap API route handler with error handling
 */
export function withErrorHandler(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error, request, {
        route: context?.route || request.url,
      });
    }
  };
}

/**
 * Handle unhandled promise rejections in API routes
 */
export function handleUnhandledRejection(reason, promise) {
  log.error("Unhandled promise rejection", reason, {
    promise: promise?.toString(),
  });
}

/**
 * Validate environment variables at startup
 */
export function validateEnvironment() {
  const required = [
    "DATABASE_URL",
    "JWT_SECRET",
    "REFRESH_TOKEN_SECRET",
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  // Warn about missing optional vars
  const optional = [
    "STRIPE_SECRET_KEY",
    "REDIS_URL",
    "GEMINI_API_KEY",
  ];

  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    log.warn("Missing optional environment variables", {
      missing: missingOptional,
    });
  }
}
