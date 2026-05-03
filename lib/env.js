const missing = [];

function getEnv(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    missing.push(name);
  }
  return value;
}

export const env = {
  databaseUrl: getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/chatvibe"),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  jwtSecret: getEnv("JWT_SECRET", "dev_jwt_secret_change_me"),
  refreshSecret: getEnv("REFRESH_TOKEN_SECRET", "dev_refresh_secret_change_me"),
  accessTokenExpiry: getEnv("ACCESS_TOKEN_EXPIRY", "15m"),
  refreshTokenExpiry: getEnv("REFRESH_TOKEN_EXPIRY", "7d"),
  bcryptRounds: parseInt(getEnv("BCRYPT_ROUNDS", "12"), 10),
  frontendOrigin: getEnv("FRONTEND_ORIGIN", "http://localhost:3000"),
  smtpHost: getEnv("SMTP_HOST", ""),
  smtpPort: Number(getEnv("SMTP_PORT", "587")),
  smtpUser: getEnv("SMTP_USER", ""),
  smtpPass: getEnv("SMTP_PASS", ""),
  stripeSecretKey: getEnv("STRIPE_SECRET_KEY", ""),
  stripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
  stripePriceIdBasic: getEnv("STRIPE_PRICE_ID_BASIC", ""),
  stripePriceIdPro: getEnv("STRIPE_PRICE_ID_PRO", ""),
  paymentsEnabled: getEnv("PAYMENTS_ENABLED", "true") === "true", // Gate for regions where Stripe live is unavailable
  groqApiKey: getEnv("GROQ_API_KEY", ""),
  geminiApiKey: getEnv("GEMINI_API_KEY", ""), // Legacy, replaced by Groq
  queueName: getEnv("QUEUE_NAME", "analysis-queue"), // BullMQ queue name
};

if (missing.length && process.env.NODE_ENV !== "production") {
  console.warn(
    `[env] Missing environment variables detected: ${missing.join(
      ", ",
    )}. Using fallbacks for development. Ensure these are configured in production.`,
  );
}

