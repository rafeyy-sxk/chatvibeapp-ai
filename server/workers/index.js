/**
 * Worker Process Entry Point
 * Standalone worker process for processing analysis jobs
 * 
 * This worker runs independently from Next.js and can be deployed separately
 * on Railway/Render/Fly.io or any Node.js hosting platform.
 * 
 * Required Environment Variables:
 * - REDIS_URL: Redis connection string for BullMQ
 * - DATABASE_URL: PostgreSQL connection string for Prisma
 * - QUEUE_NAME: BullMQ queue name (default: "analysis-queue")
 * - GEMINI_API_KEY: Google Gemini API key for analysis
 * 
 * Usage: 
 *   node server/workers/index.js
 *   Or: npm run worker
 * 
 * Deployment:
 *   Deploy this file and server/workers/analysisWorker.js along with:
 *   - lib/queue/index.js
 *   - lib/prisma.js
 *   - lib/logger/index.js
 *   - lib/env.js
 *   - server/src/services/analysisEngine.js
 *   - All dependencies from package.json
 */

import { createAnalysisWorker } from "../../lib/queue";
import { processAnalysisJob } from "./analysisWorker";
import { log } from "../../lib/logger";
import { env } from "../../lib/env";

// Validate required environment variables
const requiredEnvVars = ["REDIS_URL", "DATABASE_URL", "GEMINI_API_KEY"];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars.join(", "));
  console.error("Please set these variables before starting the worker.");
  process.exit(1);
}

// Create worker with environment-based configuration
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);
const maxJobs = parseInt(process.env.WORKER_MAX_JOBS || "10", 10);

const worker = createAnalysisWorker(
  async (job) => {
    log.info("Worker processing job", { 
      jobId: job.id, 
      attempt: job.attemptsMade,
      queueName: env.queueName 
    });
    
    try {
      const result = await processAnalysisJob(job);
      return result;
    } catch (error) {
      log.error("Worker job failed", error, { 
        jobId: job.id, 
        attempt: job.attemptsMade 
      });
      throw error; // Let BullMQ handle retries
    }
  },
  {
    concurrency,
    maxJobs,
  }
);

// Worker event handlers
worker.on("completed", (job) => {
  log.info("Job completed", { jobId: job.id });
});

worker.on("failed", (job, error) => {
  log.error("Job failed", error, { 
    jobId: job?.id, 
    attempts: job?.attemptsMade 
  });
});

worker.on("error", (error) => {
  log.error("Worker error", error);
});

worker.on("active", (job) => {
  log.info("Job started", { jobId: job.id });
});

// Graceful shutdown
async function shutdown() {
  log.info("Shutting down worker gracefully...");
  try {
    // Close worker first
    await worker.close();
    log.info("Worker closed successfully");
    
    // Close Prisma connection
    try {
      const prisma = (await import("../../lib/prisma")).default;
      await prisma.$disconnect();
      log.info("Prisma connection closed");
    } catch (prismaError) {
      log.warn("Error closing Prisma connection", prismaError);
    }
    
    // Close Redis connection
    try {
      const { connection } = await import("../../lib/queue");
      await connection.quit();
      log.info("Redis connection closed");
    } catch (redisError) {
      log.warn("Error closing Redis connection", redisError);
    }
    
    process.exit(0);
  } catch (error) {
    log.error("Error during worker shutdown", error);
    process.exit(1);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  log.error("Uncaught exception", error);
  shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled rejection", reason, { promise });
});

// Log startup information
log.info("Analysis worker started", { 
  concurrency,
  maxJobs,
  queueName: env.queueName,
  redisUrl: env.redisUrl ? `${env.redisUrl.substring(0, 20)}...` : "not configured",
});

