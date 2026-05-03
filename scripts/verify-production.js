/**
 * Production Verification Script
 * Tests all connections and configurations before deployment
 */

import prisma from "../lib/prisma.js";
import { getRedisClient } from "../lib/redis.js";
import { stripe } from "../lib/billing/stripe.js";
import { env } from "../lib/env.js";

const results = {
  database: false,
  redis: false,
  stripe: false,
  env: false,
};

async function testDatabase() {
  console.log("🔍 Testing Neon PostgreSQL connection...");
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as test, version() as version`;
    console.log("✅ Database: CONNECTED");
    console.log(`   Test query: ${JSON.stringify(result[0])}`);
    results.database = true;
  } catch (error) {
    console.error("❌ Database: FAILED");
    console.error(`   ${error.message}`);
    results.database = false;
  }
}

async function testRedis() {
  console.log("\n🔍 Testing Redis connection...");
  try {
    const redis = getRedisClient();
    await redis.connect();
    await redis.set("test:verification", "ok", "EX", 10);
    const value = await redis.get("test:verification");
    await redis.del("test:verification");
    await redis.disconnect();
    
    if (value === "ok") {
      console.log("✅ Redis: CONNECTED");
      results.redis = true;
    } else {
      throw new Error("Unexpected value");
    }
  } catch (error) {
    console.error("❌ Redis: FAILED");
    console.error(`   ${error.message}`);
    results.redis = false;
  }
}

async function testStripe() {
  console.log("\n🔍 Testing Stripe configuration...");
  if (!stripe) {
    console.warn("⚠️  Stripe: NOT CONFIGURED (optional for testing)");
    results.stripe = false;
    return;
  }
  
  try {
    const account = await stripe.accounts.retrieve();
    console.log("✅ Stripe API: CONNECTED");
    console.log(`   Account: ${account.id}`);
    
    // Check env vars
    const hasWebhook = !!env.stripeWebhookSecret;
    const hasBasic = !!env.stripePriceIdBasic;
    const hasPro = !!env.stripePriceIdPro;
    
    console.log(`   Webhook Secret: ${hasWebhook ? "✅" : "❌"}`);
    console.log(`   BASIC Price ID: ${hasBasic ? "✅" : "❌"}`);
    console.log(`   PRO Price ID: ${hasPro ? "✅" : "❌"}`);
    
    results.stripe = hasWebhook && hasBasic && hasPro;
  } catch (error) {
    console.error("❌ Stripe: FAILED");
    console.error(`   ${error.message}`);
    results.stripe = false;
  }
}

function testEnvironment() {
  console.log("\n🔍 Verifying environment variables...");
  const required = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "REFRESH_TOKEN_SECRET"];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error("❌ Missing required variables:");
    missing.forEach(key => console.error(`   - ${key}`));
    results.env = false;
    return;
  }
  
  // Check for client-side exposure
  const exposed = Object.keys(process.env)
    .filter(key => key.startsWith("NEXT_PUBLIC_") && 
      (key.includes("SECRET") || key.includes("KEY") || key.includes("DATABASE") || key.includes("STRIPE")));
  
  if (exposed.length > 0) {
    console.error("❌ SECURITY: Secrets exposed to client:");
    exposed.forEach(key => console.error(`   - ${key}`));
    results.env = false;
    return;
  }
  
  console.log("✅ Environment: VALID");
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? "✅ (server-only)" : "❌"}`);
  console.log(`   REDIS_URL: ${process.env.REDIS_URL ? "✅" : "❌"}`);
  console.log(`   No secrets in client: ✅`);
  results.env = true;
}

async function main() {
  console.log("=".repeat(60));
  console.log("PRODUCTION VERIFICATION");
  console.log("=".repeat(60));
  
  testEnvironment();
  await testDatabase();
  await testRedis();
  await testStripe();
  
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Environment: ${results.env ? "✅" : "❌"}`);
  console.log(`Database:    ${results.database ? "✅" : "❌"}`);
  console.log(`Redis:       ${results.redis ? "✅" : "❌"}`);
  console.log(`Stripe:      ${results.stripe ? "✅" : "⚠️ "}`);
  
  const critical = results.env && results.database && results.redis;
  
  if (critical) {
    console.log("\n✅ CRITICAL SERVICES: READY");
    console.log("   Ready for Vercel deployment");
  } else {
    console.log("\n❌ CRITICAL SERVICES: FAILED");
    console.log("   Fix issues before deployment");
    process.exit(1);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
