/**
 * Test Database Connection to Neon
 * Verifies DATABASE_URL from .env.local and connects to Neon PostgreSQL
 */

import prisma from "../lib/prisma.js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

async function testConnection() {
  console.log("=".repeat(60));
  console.log("TESTING NEON DATABASE CONNECTION");
  console.log("=".repeat(60));

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in .env.local");
    console.error("Please add DATABASE_URL to .env.local file");
    process.exit(1);
  }

  // Mask password in URL for display
  const maskedUrl = DATABASE_URL.replace(/:[^:@]+@/, ":****@");
  console.log(`\n📋 Database URL: ${maskedUrl}`);

  // Check if it's a Neon URL
  if (DATABASE_URL.includes("neon.tech")) {
    console.log("✅ Detected Neon PostgreSQL database");
    if (DATABASE_URL.includes("-pooler")) {
      console.log("✅ Using Neon connection pooler (recommended for serverless)");
    } else {
      console.warn("⚠️  Not using pooler - consider using pooler URL for better performance");
    }
  }

  console.log("\n🔍 Testing connection...");

  try {
    // Connect to database
    await prisma.$connect();
    console.log("✅ Connected to database successfully!");

    // Test query
    console.log("\n🔍 Running test query...");
    const result = await prisma.$queryRaw`SELECT version() as version, current_database() as database, current_user as user`;
    console.log("✅ Test query successful!");
    console.log("\n📊 Database Info:");
    console.log(`   Database: ${result[0].database}`);
    console.log(`   User: ${result[0].user}`);
    console.log(`   PostgreSQL Version: ${result[0].version.split(" ")[0]} ${result[0].version.split(" ")[1]}`);

    // Check if tables exist
    console.log("\n🔍 Checking database schema...");
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    if (tables.length > 0) {
      console.log(`✅ Found ${tables.length} tables in database:`);
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table_name}`);
      });
    } else {
      console.log("⚠️  No tables found - database is empty");
      console.log("   Run: npm run db:migrate:prod to create tables");
    }

    // Test Prisma Client
    console.log("\n🔍 Testing Prisma Client...");
    try {
      const userCount = await prisma.user.count();
      console.log(`✅ Prisma Client working! Found ${userCount} users in database`);
    } catch (error) {
      if (error.message.includes("does not exist")) {
        console.log("⚠️  Tables don't exist yet - need to run migrations");
      } else {
        throw error;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ DATABASE CONNECTION SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("\nNext steps:");
    console.log("1. Run migrations: npm run db:migrate:prod");
    console.log("2. Or push schema: npm run db:push");
    console.log("3. Verify tables: npm run db:studio");

  } catch (error) {
    console.error("\n❌ Connection failed!");
    console.error(`Error: ${error.message}`);
    
    if (error.message.includes("P1001")) {
      console.error("\n💡 Troubleshooting:");
      console.error("   - Check if DATABASE_URL is correct");
      console.error("   - Verify Neon database is running");
      console.error("   - Check network/firewall settings");
    } else if (error.message.includes("P1000")) {
      console.error("\n💡 Troubleshooting:");
      console.error("   - Check database credentials");
      console.error("   - Verify database exists in Neon");
    } else if (error.message.includes("does not exist")) {
      console.error("\n💡 Database connected but tables don't exist");
      console.error("   Run: npm run db:migrate:prod");
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
