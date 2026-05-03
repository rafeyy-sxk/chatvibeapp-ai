/**
 * Rate Limit Stress Test
 * Simulates high-frequency traffic to verify rate limiting
 */

import fetch from "node-fetch";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_TOKEN = process.env.TEST_TOKEN || ""; // Get from test user

async function makeRequest(endpoint, token) {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: endpoint === "/api/analyze" ? "POST" : "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: endpoint === "/api/analyze" ? JSON.stringify({ images: [] }) : undefined,
    });
    
    const duration = Date.now() - start;
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      duration,
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      duration: Date.now() - start,
    };
  }
}

async function stressTest(endpoint, token, requests = 100, concurrency = 10) {
  console.log(`\n🔥 Stress testing ${endpoint}`);
  console.log(`   Requests: ${requests}, Concurrency: ${concurrency}\n`);
  
  const results = {
    success: 0,
    rateLimited: 0,
    errors: 0,
    durations: [],
  };
  
  const promises = [];
  for (let i = 0; i < requests; i++) {
    promises.push(
      makeRequest(endpoint, token).then(result => {
        if (result.status === 200 || result.status === 202) {
          results.success++;
        } else if (result.status === 429) {
          results.rateLimited++;
          const retryAfter = result.headers["retry-after"];
          if (retryAfter) {
            console.log(`   [${i}] Rate limited - Retry-After: ${retryAfter}s`);
          }
        } else {
          results.errors++;
          console.log(`   [${i}] Error: ${result.status} ${result.error || ""}`);
        }
        results.durations.push(result.duration);
      })
    );
    
    // Batch by concurrency
    if (promises.length >= concurrency) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  
  // Wait for remaining
  await Promise.all(promises);
  
  const avgDuration = results.durations.reduce((a, b) => a + b, 0) / results.durations.length;
  const maxDuration = Math.max(...results.durations);
  
  console.log(`\n   ✅ Results:`);
  console.log(`      Success: ${results.success}`);
  console.log(`      Rate Limited (429): ${results.rateLimited}`);
  console.log(`      Errors: ${results.errors}`);
  console.log(`      Avg Duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`      Max Duration: ${maxDuration}ms`);
  
  return results;
}

async function main() {
  if (!TEST_TOKEN) {
    console.error("❌ TEST_TOKEN environment variable required");
    process.exit(1);
  }
  
  console.log("🧪 Rate Limit Stress Test Suite");
  console.log("=" .repeat(50));
  
  // Test analyze endpoint
  await stressTest("/api/analyze", TEST_TOKEN, 20, 5);
  
  // Test reports endpoint
  await stressTest("/api/reports", TEST_TOKEN, 50, 10);
  
  console.log("\n✅ Stress test complete");
}

main().catch(console.error);
