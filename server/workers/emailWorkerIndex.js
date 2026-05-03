/**
 * Email Worker Entry Point
 * Run this separately to process email jobs
 * 
 * Usage: node server/workers/emailWorkerIndex.js
 * Or deploy separately on Railway/Render
 */

import { Worker } from "bullmq";
import { processEmailJob } from "./emailWorker";
import { log } from "../../lib/logger";
import { createRedisConnection } from "../../lib/queue";

// Validate required environment variables
const requiredEnvVars = ["REDIS_URL"];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}

// Create worker for email queue
const emailConnection = createRedisConnection();
const concurrency = parseInt(process.env.EMAIL_WORKER_CONCURRENCY || "10", 10);

const worker = new Worker(
  "email-queue", // Queue name
  async (job) => {
    log.info("Email worker processing job", { jobId: job.id, jobName: job.name });
    
    try {
      const result = await processEmailJob(job);
      return result;
    } catch (error) {
      log.error("Email job failed", error, { jobId: job.id });
      throw error;
    }
  },
  {
    connection: emailConnection,
    concurrency,
    limiter: {
      max: 20, // Max 20 jobs per second
      duration: 1000,
    },
  }
);

// Event handlers
worker.on("completed", (job) => {
  log.info("Email job completed", { jobId: job.id });
});

worker.on("failed", (job, error) => {
  log.error("Email job failed", error, { jobId: job?.id });
});

// Graceful shutdown
async function shutdown() {
  log.info("Shutting down email worker...");
  await worker.close();
  await emailConnection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

log.info("Email worker started", { concurrency, queueName: "email-queue" });
