import * as Sentry from "@sentry/node";
// Re-export everything from the structured logger
export * from "./logger/index";
export { default } from "./logger/index";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

export function captureException(error, context = {}) {
  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  } else {
    // Fallback logging in environments without Sentry configured
    // eslint-disable-next-line no-console
    console.error("[error]", error, context);
  }
}

