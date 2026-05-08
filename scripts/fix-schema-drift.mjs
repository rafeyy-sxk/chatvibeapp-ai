/**
 * One-shot schema drift fixer.
 * Adds missing columns/tables to production DB idempotently.
 * Run with: node scripts/fix-schema-drift.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run(label, sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✅ ${label}`);
  } catch (e) {
    if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
      console.log(`⏭️  ${label} (already exists, skipped)`);
    } else {
      console.error(`❌ ${label}: ${e.message}`);
      throw e;
    }
  }
}

async function main() {
  console.log("🔧 Applying schema drift fixes to production DB...\n");

  // 1. User table missing columns
  await run('User.updatedAt', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
  await run('User.lastLoginAt', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)`);
  await run('User.lastLoginIp', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT`);
  await run('User.lastLoginUserAgent', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginUserAgent" TEXT`);

  // 2. JobStatus enum
  await run('JobStatus enum', `
    DO $$ BEGIN
      CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'OCR_IN_PROGRESS', 'ANALYSIS_IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT');
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);

  // 3. AnalysisJob table (create if not exists, then add missing columns)
  await run('AnalysisJob table', `
    CREATE TABLE IF NOT EXISTS "AnalysisJob" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
      "progress" INTEGER NOT NULL DEFAULT 0,
      "priority" INTEGER NOT NULL DEFAULT 5,
      "inputText" TEXT,
      "imageCount" INTEGER,
      "customPrompt" TEXT,
      "errorMessage" TEXT,
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "maxRetries" INTEGER NOT NULL DEFAULT 3,
      "startedAt" TIMESTAMP(3),
      "completedAt" TIMESTAMP(3),
      "failedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "vibe" TEXT,
      "shareToken" TEXT,
      "isPublic" BOOLEAN NOT NULL DEFAULT false,
      "language" TEXT NOT NULL DEFAULT 'eng',
      CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
    )
  `);

  // Add columns that might be missing if table already existed
  for (const [col, def] of [
    ['progress', 'INTEGER NOT NULL DEFAULT 0'],
    ['priority', 'INTEGER NOT NULL DEFAULT 5'],
    ['inputText', 'TEXT'],
    ['imageCount', 'INTEGER'],
    ['customPrompt', 'TEXT'],
    ['errorMessage', 'TEXT'],
    ['retryCount', 'INTEGER NOT NULL DEFAULT 0'],
    ['maxRetries', 'INTEGER NOT NULL DEFAULT 3'],
    ['startedAt', 'TIMESTAMP(3)'],
    ['completedAt', 'TIMESTAMP(3)'],
    ['failedAt', 'TIMESTAMP(3)'],
    ['updatedAt', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['vibe', 'TEXT'],
    ['shareToken', 'TEXT'],
    ['isPublic', 'BOOLEAN NOT NULL DEFAULT false'],
    ['language', "TEXT NOT NULL DEFAULT 'eng'"],
  ]) {
    await run(`AnalysisJob.${col}`, `ALTER TABLE "AnalysisJob" ADD COLUMN IF NOT EXISTS "${col}" ${def}`);
  }

  // 4. AnalysisReport.jobId
  await run('AnalysisReport.jobId', `ALTER TABLE "AnalysisReport" ADD COLUMN IF NOT EXISTS "jobId" TEXT`);

  // 5. New tables
  await run('UserSession table', `
    CREATE TABLE IF NOT EXISTS "UserSession" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "refreshTokenId" TEXT,
      "deviceFingerprint" TEXT NOT NULL,
      "userAgent" TEXT NOT NULL,
      "ipAddress" TEXT NOT NULL,
      "location" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
    )
  `);

  await run('UserActivityLog table', `
    CREATE TABLE IF NOT EXISTS "UserActivityLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "activityType" TEXT NOT NULL,
      "ipAddress" TEXT NOT NULL,
      "userAgent" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserActivityLog_pkey" PRIMARY KEY ("id")
    )
  `);

  await run('CacheEntry table', `
    CREATE TABLE IF NOT EXISTS "CacheEntry" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CacheEntry_pkey" PRIMARY KEY ("key")
    )
  `);

  // 6. Foreign keys
  await run('FK AnalysisJob->User', `
    DO $$ BEGIN
      ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);
  await run('FK AnalysisReport->AnalysisJob', `
    DO $$ BEGIN
      ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);
  await run('UNIQUE AnalysisReport.jobId', `
    DO $$ BEGIN
      ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_jobId_key" UNIQUE ("jobId");
    EXCEPTION WHEN SQLSTATE '42P07' THEN null; WHEN duplicate_object THEN null; END $$
  `);
  await run('FK UserSession->User', `
    DO $$ BEGIN
      ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);
  await run('FK UserSession->RefreshToken', `
    DO $$ BEGIN
      ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_refreshTokenId_fkey" FOREIGN KEY ("refreshTokenId") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);
  await run('FK UserActivityLog->User', `
    DO $$ BEGIN
      ALTER TABLE "UserActivityLog" ADD CONSTRAINT "UserActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$
  `);

  // 7. Indexes
  const indexes = [
    ['AnalysisJob_shareToken_key', 'CREATE UNIQUE INDEX IF NOT EXISTS "AnalysisJob_shareToken_key" ON "AnalysisJob"("shareToken")'],
    ['UserSession_refreshTokenId_key', 'CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_refreshTokenId_key" ON "UserSession"("refreshTokenId")'],
    ['AnalysisJob_userId_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "AnalysisJob_userId_createdAt_idx" ON "AnalysisJob"("userId", "createdAt")'],
    ['AnalysisJob_status_priority_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "AnalysisJob_status_priority_createdAt_idx" ON "AnalysisJob"("status", "priority", "createdAt")'],
    ['AnalysisJob_status_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "AnalysisJob_status_createdAt_idx" ON "AnalysisJob"("status", "createdAt")'],
    ['AnalysisJob_userId_status_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "AnalysisJob_userId_status_createdAt_idx" ON "AnalysisJob"("userId", "status", "createdAt")'],
    ['AnalysisReport_jobId_idx', 'CREATE INDEX IF NOT EXISTS "AnalysisReport_jobId_idx" ON "AnalysisReport"("jobId")'],
    ['AnalysisReport_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "AnalysisReport_createdAt_idx" ON "AnalysisReport"("createdAt")'],
    ['AnalysisReport_userId_createdAt_desc_idx', 'CREATE INDEX IF NOT EXISTS "AnalysisReport_userId_createdAt_desc_idx" ON "AnalysisReport"("userId", "createdAt" DESC)'],
    ['UserSession_userId_isActive_idx', 'CREATE INDEX IF NOT EXISTS "UserSession_userId_isActive_idx" ON "UserSession"("userId", "isActive")'],
    ['UserSession_deviceFingerprint_idx', 'CREATE INDEX IF NOT EXISTS "UserSession_deviceFingerprint_idx" ON "UserSession"("deviceFingerprint")'],
    ['UserSession_expiresAt_idx', 'CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx" ON "UserSession"("expiresAt")'],
    ['UserActivityLog_userId_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "UserActivityLog_userId_createdAt_idx" ON "UserActivityLog"("userId", "createdAt")'],
    ['UserActivityLog_activityType_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "UserActivityLog_activityType_createdAt_idx" ON "UserActivityLog"("activityType", "createdAt")'],
    ['UserActivityLog_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "UserActivityLog_createdAt_idx" ON "UserActivityLog"("createdAt")'],
    ['CacheEntry_expiresAt_idx', 'CREATE INDEX IF NOT EXISTS "CacheEntry_expiresAt_idx" ON "CacheEntry"("expiresAt")'],
    ['CacheEntry_createdAt_idx', 'CREATE INDEX IF NOT EXISTS "CacheEntry_createdAt_idx" ON "CacheEntry"("createdAt")'],
  ];

  for (const [label, sql] of indexes) {
    await run(label, sql);
  }

  console.log("\n🎉 Schema drift fix complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
