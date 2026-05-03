/**
 * Email Queue - Example of adding a new job type
 * This shows how to create additional queues for different job types
 */

import { Queue } from "bullmq";
import { createRedisConnection } from "./index";

// Create a separate queue for email jobs
const emailConnection = createRedisConnection();

export const emailQueue = new Queue("email-queue", {
  connection: emailConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep for 24 hours
      count: 500,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed for 7 days
    },
  },
});

/**
 * Add email job to queue
 */
export async function addEmailJob(data, options = {}) {
  const job = await emailQueue.add(
    "send-email", // Job type name
    data, // Job data: { to, subject, template, data }
    {
      priority: options.priority || 5,
      delay: options.delay || 0, // Optional delay in ms
      ...options,
    }
  );
  return job;
}

/**
 * Get email job status
 */
export async function getEmailJobStatus(jobId) {
  const job = await emailQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    id: job.id,
    status: state,
    progress: job.progress || 0,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
  };
}
