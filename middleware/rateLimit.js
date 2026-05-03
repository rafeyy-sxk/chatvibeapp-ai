/**
 * @deprecated Use lib/rateLimit.js enforceRateLimit instead
 * Kept for backward compatibility with auth routes
 */
import { enforceRateLimit as newEnforceRateLimit } from "../lib/rateLimit";

export async function enforceRateLimit(request, keyHint = "global") {
  return newEnforceRateLimit(request, {
    limit: 20,
    windowSeconds: 60,
    keyPrefix: keyHint,
  });
}

