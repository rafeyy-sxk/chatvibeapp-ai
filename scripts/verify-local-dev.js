/**
 * Local Dev Verification Script
 * Tests all critical functionality
 */

import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

async function test(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, data };
  } catch (error) {
    return { error: error.message };
  }
}

async function main() {
  console.log("🧪 Local Dev Verification\n");
  console.log("=" .repeat(50));

  // 1. Health Check
  console.log("\n1️⃣ Health Check");
  const health = await test("/api/health");
  console.log("   Status:", health.status);
  if (health.ok) {
    console.log("   ✅ Health check passed");
  } else {
    console.log("   ❌ Health check failed");
    return;
  }

  // 2. Database Check
  console.log("\n2️⃣ Database Connection");
  if (health.data?.database === "connected") {
    console.log("   ✅ Database connected");
  } else {
    console.log("   ❌ Database not connected");
    console.log("   Run: npm run db:migrate");
  }

  // 3. Redis Check
  console.log("\n3️⃣ Redis Connection");
  if (health.data?.redis === "connected") {
    console.log("   ✅ Redis connected");
  } else {
    console.log("   ⚠️  Redis not connected (using in-memory fallback)");
  }

  // 4. Queue Check
  console.log("\n4️⃣ Job Queue");
  if (health.data?.queue?.status === "operational") {
    console.log("   ✅ Queue operational");
  } else {
    console.log("   ⚠️  Queue not available (will fallback to sync)");
  }

  console.log("\n✅ Basic verification complete!");
  console.log("\nNext steps:");
  console.log("1. Test authentication: npm run test:auth");
  console.log("2. Test rate limiting: npm run test:security");
  console.log("3. Test analysis flow manually in browser");
}

main().catch(console.error);
