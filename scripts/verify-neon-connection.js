/**
 * Verify Neon Database Connection and Tables
 */

import prisma from "../lib/prisma.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function verify() {
  console.log("=".repeat(60));
  console.log("VERIFYING NEON DATABASE CONNECTION");
  console.log("=".repeat(60));

  try {
    await prisma.$connect();
    console.log("✅ Connected to Neon database");

    // Check tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    console.log(`\n✅ Found ${tables.length} tables:`);
    tables.forEach((t, i) => console.log(`   ${i + 1}. ${t.table_name}`));

    // Test User model
    const userCount = await prisma.user.count();
    console.log(`\n✅ Prisma Client working! Users: ${userCount}`);

    // Test a query
    const dbInfo = await prisma.$queryRaw`SELECT current_database() as db, version() as version`;
    console.log(`\n📊 Database: ${dbInfo[0].db}`);
    console.log(`   Version: ${dbInfo[0].version.split(" ")[0]} ${dbInfo[0].version.split(" ")[1]}`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ NEON DATABASE FULLY CONNECTED AND READY!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
