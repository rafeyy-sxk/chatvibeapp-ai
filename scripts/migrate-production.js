/**
 * Production Migration Script
 * Run this after deploying to production to ensure database is up to date
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Make this async-compatible
async function runMigration() {

console.log('🚀 Starting production database migration...\n');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL before running migrations');
  process.exit(1);
}

// Check if connection pooling is configured
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl.includes('pgbouncer=true') && !dbUrl.includes('prisma-data-proxy')) {
  console.warn('⚠️  WARNING: DATABASE_URL does not include connection pooling');
  console.warn('For Vercel/serverless, add ?pgbouncer=true to DATABASE_URL');
  console.warn('Or use Prisma Data Proxy connection string\n');
}

try {
  // Generate Prisma Client
  console.log('📦 Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
  console.log('✅ Prisma Client generated\n');

  // Run migrations
  console.log('🔄 Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  console.log('✅ Migrations completed\n');

  // Verify connection by checking if we can query
  console.log('🔍 Verifying database connection...');
  try {
    // Use a simple query to verify connection
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    console.log('✅ Database connection verified\n');
  } catch (verifyError) {
    console.warn('⚠️  Could not verify connection with query, but migration completed');
    console.warn('   Error:', verifyError.message);
  }

  console.log('🎉 Production migration completed successfully!');
}

// Run the migration
runMigration().catch((error) => {
  console.error('❌ Migration failed:', error.message);
  if (error.stderr) {
    console.error('   Error details:', error.stderr.toString());
  }
  process.exit(1);
});
