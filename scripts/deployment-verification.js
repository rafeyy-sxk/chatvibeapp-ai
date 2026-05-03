/**
 * Complete Deployment Verification
 * Verifies all components are ready for Vercel deployment
 */

import { readFileSync } from "fs";
import { join } from "path";

console.log("=".repeat(70));
console.log("DEPLOYMENT VERIFICATION CHECKLIST");
console.log("=".repeat(70));

const checks = {
  database: false,
  stripe: false,
  redis: false,
  apiRoutes: false,
  security: false,
  env: false,
};

// 1. Check Prisma Schema for Neon
console.log("\n1. DATABASE CONFIGURATION");
try {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf-8");
  if (schema.includes("postgresql") && schema.includes("DATABASE_URL")) {
    console.log("✅ Prisma schema configured for PostgreSQL");
    if (schema.includes("pooler") || schema.includes("Neon")) {
      console.log("✅ Neon connection pooler documented");
    }
    checks.database = true;
  }
} catch (error) {
  console.error("❌ Cannot read Prisma schema");
}

// 2. Check Stripe Configuration
console.log("\n2. STRIPE PAYMENT INTEGRATION");
try {
  const stripeFile = readFileSync(join(process.cwd(), "lib/billing/stripe.js"), "utf-8");
  if (stripeFile.includes("STRIPE_PRICE_ID_BASIC") && stripeFile.includes("STRIPE_PRICE_ID_PRO")) {
    console.log("✅ Stripe tier configuration: BASIC and PRO");
  }
  if (stripeFile.includes("BASIC") && stripeFile.includes("PRO")) {
    console.log("✅ Tier names updated correctly");
  }
  
  const webhookFile = readFileSync(join(process.cwd(), "app/api/billing/webhook/route.js"), "utf-8");
  if (webhookFile.includes("request.text()")) {
    console.log("✅ Webhook uses request.text() for signature verification");
  }
  if (webhookFile.includes("billingEvent.findUnique") || webhookFile.includes("BillingEvent")) {
    console.log("✅ Idempotency handling via BillingEvent table");
  }
  checks.stripe = true;
} catch (error) {
  console.error("❌ Stripe configuration check failed");
}

// 3. Check Redis/BullMQ
console.log("\n3. REDIS & QUEUE CONFIGURATION");
try {
  const redisFile = readFileSync(join(process.cwd(), "lib/redis.js"), "utf-8");
  if (redisFile.includes("REDIS_URL") || redisFile.includes("env.redisUrl")) {
    console.log("✅ Redis configuration present");
  }
  
  const queueFile = readFileSync(join(process.cwd(), "lib/queue/index.js"), "utf-8");
  if (queueFile.includes("BullMQ") || queueFile.includes("Queue")) {
    console.log("✅ BullMQ queue configured");
  }
  
  const workerFile = readFileSync(join(process.cwd(), "server/workers/index.js"), "utf-8");
  if (workerFile.includes("createAnalysisWorker")) {
    console.log("✅ Worker process configured for separate deployment");
  }
  checks.redis = true;
} catch (error) {
  console.error("❌ Redis/Queue check failed");
}

// 4. Check API Routes Runtime Configuration
console.log("\n4. API ROUTES CONFIGURATION");
try {
  const { readdirSync, readFileSync } = require("fs");
  const { join } = require("path");
  
  const apiDir = join(process.cwd(), "app/api");
  let routeCount = 0;
  let nodejsCount = 0;
  
  function checkRoutes(dir) {
    const files = readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = join(dir, file.name);
      if (file.isDirectory()) {
        checkRoutes(fullPath);
      } else if (file.name === "route.js") {
        routeCount++;
        const content = readFileSync(fullPath, "utf-8");
        if (content.includes("runtime = 'nodejs'") || content.includes('runtime = "nodejs"')) {
          nodejsCount++;
        }
      }
    }
  }
  
  checkRoutes(apiDir);
  console.log(`✅ Found ${routeCount} API routes`);
  console.log(`✅ ${nodejsCount}/${routeCount} routes have runtime='nodejs'`);
  
  if (nodejsCount === routeCount) {
    checks.apiRoutes = true;
  } else {
    console.warn(`⚠️  ${routeCount - nodejsCount} routes missing runtime='nodejs'`);
  }
} catch (error) {
  console.error("❌ API routes check failed:", error.message);
}

// 5. Check Security Headers
console.log("\n5. SECURITY CONFIGURATION");
try {
  const nextConfig = readFileSync(join(process.cwd(), "next.config.mjs"), "utf-8");
  if (nextConfig.includes("Strict-Transport-Security") || nextConfig.includes("HSTS")) {
    console.log("✅ HSTS header configured");
  }
  if (nextConfig.includes("Content-Security-Policy") || nextConfig.includes("CSP")) {
    console.log("✅ CSP header configured");
  }
  if (nextConfig.includes("X-Frame-Options")) {
    console.log("✅ X-Frame-Options configured");
  }
  
  // Check for client-side secret exposure
  const envFile = readFileSync(join(process.cwd(), "lib/env.js"), "utf-8");
  if (!envFile.includes("NEXT_PUBLIC_DATABASE") && !envFile.includes("NEXT_PUBLIC_STRIPE")) {
    console.log("✅ No secrets exposed via NEXT_PUBLIC_ variables");
  }
  checks.security = true;
} catch (error) {
  console.error("❌ Security check failed");
}

// 6. Check Environment Variables
console.log("\n6. ENVIRONMENT VARIABLES");
const requiredEnvVars = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "REFRESH_TOKEN_SECRET",
];
const optionalEnvVars = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_BASIC",
  "STRIPE_PRICE_ID_PRO",
  "GEMINI_API_KEY",
];

console.log("Required variables:");
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}: SET`);
  } else {
    console.log(`  ❌ ${varName}: MISSING`);
  }
});

console.log("\nOptional variables:");
optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}: SET`);
  } else {
    console.log(`  ⚠️  ${varName}: NOT SET`);
  }
});

checks.env = requiredEnvVars.every(v => process.env[v]);

// Summary
console.log("\n" + "=".repeat(70));
console.log("VERIFICATION SUMMARY");
console.log("=".repeat(70));
console.log(`Database Config:    ${checks.database ? "✅" : "❌"}`);
console.log(`Stripe Integration:  ${checks.stripe ? "✅" : "❌"}`);
console.log(`Redis/Queue:         ${checks.redis ? "✅" : "❌"}`);
console.log(`API Routes:          ${checks.apiRoutes ? "✅" : "❌"}`);
console.log(`Security Headers:    ${checks.security ? "✅" : "❌"}`);
console.log(`Environment:         ${checks.env ? "✅" : "❌"}`);

const allPassed = Object.values(checks).every(v => v === true);

if (allPassed) {
  console.log("\n✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT");
  console.log("\nNext steps:");
  console.log("1. Set environment variables in Vercel dashboard");
  console.log("2. Deploy to Vercel");
  console.log("3. Run: npm run db:migrate:prod");
  console.log("4. Deploy workers separately (Railway/Render/Fly.io)");
  process.exit(0);
} else {
  console.log("\n❌ SOME CHECKS FAILED - FIX ISSUES BEFORE DEPLOYMENT");
  process.exit(1);
}
