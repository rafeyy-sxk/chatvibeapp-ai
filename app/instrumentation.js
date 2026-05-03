/**
 * Next.js Instrumentation Hook
 * Initializes OpenTelemetry and other monitoring tools
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize OpenTelemetry
    const { initTelemetry } = await import("@/lib/telemetry");
    initTelemetry();

    // Initialize Sentry (already done in lib/logger, but ensure it's loaded)
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/node");
      if (!Sentry.getCurrentHub().getClient()) {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
          environment: process.env.NODE_ENV || "development",
        });
      }
    }
  }
}

