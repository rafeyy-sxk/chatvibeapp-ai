/**
 * Migration Script: Update Subscription Tier Names
 * 
 * Migrates existing subscriptions from old tier names to new ones:
 * - STARTER → BASIC
 * - PRO_STUDENT → PRO
 * 
 * Run this AFTER deploying the new schema:
 * node scripts/migrate-tier-names.js
 */

import prisma from "../lib/prisma.js";
import { log } from "../lib/logger/index.js";

async function migrateTierNames() {
  console.log("🔄 Starting tier name migration...");

  try {
    // Update STARTER → BASIC
    const starterResult = await prisma.billingSubscription.updateMany({
      where: { tier: "STARTER" },
      data: { tier: "BASIC" },
    });
    console.log(`✅ Updated ${starterResult.count} subscriptions: STARTER → BASIC`);

    // Update PRO_STUDENT → PRO
    const proStudentResult = await prisma.billingSubscription.updateMany({
      where: { tier: "PRO_STUDENT" },
      data: { tier: "PRO" },
    });
    console.log(`✅ Updated ${proStudentResult.count} subscriptions: PRO_STUDENT → PRO`);

    // Verify migration
    const remaining = await prisma.billingSubscription.findMany({
      where: {
        tier: { in: ["STARTER", "PRO_STUDENT"] },
      },
    });

    if (remaining.length > 0) {
      console.warn(`⚠️  Warning: ${remaining.length} subscriptions still have old tier names`);
      console.warn("   This may indicate the Prisma schema hasn't been migrated yet.");
    } else {
      console.log("✅ All subscriptions migrated successfully!");
    }

    console.log("\n📊 Migration Summary:");
    console.log(`   STARTER → BASIC: ${starterResult.count}`);
    console.log(`   PRO_STUDENT → PRO: ${proStudentResult.count}`);
    console.log(`   Remaining old tiers: ${remaining.length}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    
    if (error.message.includes("Unknown arg `tier`")) {
      console.error("\n⚠️  Error: Prisma schema may not be migrated yet.");
      console.error("   Run: npx prisma migrate deploy");
      console.error("   Then run this script again.");
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateTierNames()
  .then(() => {
    console.log("\n✅ Migration complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
