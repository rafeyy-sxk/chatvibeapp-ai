/**
 * BullMQ Job Queue Configuration
 * Lazy initialization — queue objects are created on first use, not at module import.
 * This prevents build-time Redis connection attempts on Vercel.
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis";
import { env } from "../env.js";

export function createRedisConnection() {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
}

// Lazy singletons — created on first access, never at import time
let _connection = null;
let _analysisQueue = null;
let _queueEvents = null;

function getConnection() {
  if (!_connection) _connection = createRedisConnection();
  return _connection;
}

export function getAnalysisQueue() {
  if (!_analysisQueue) {
    _analysisQueue = new Queue(env.queueName, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
        timeout: 5 * 60 * 1000,
      },
    });
  }
  return _analysisQueue;
}

// Keep analysisQueue as a named export for backward-compat — use proxy to defer init
export const analysisQueue = new Proxy({}, {
  get(_, prop) {
    return getAnalysisQueue()[prop];
  },
});

export function createAnalysisWorker(processor, options = {}) {
  const workerConnection = options.connection || createRedisConnection();
  return new Worker(env.queueName, processor, {
    connection: workerConnection,
    concurrency: options.concurrency || 5,
    limiter: { max: options.maxJobs || 10, duration: 1000 },
  });
}

export async function addAnalysisJob(data, options = {}) {
  return getAnalysisQueue().add("analyze", data, {
    priority: options.priority || 5,
    ...options,
  });
}

export async function getJobStatus(jobId) {
  const job = await getAnalysisQueue().getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  return {
    id: job.id,
    status: state,
    progress: job.progress || 0,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

export async function closeQueue() {
  if (_analysisQueue) await _analysisQueue.close();
  if (_queueEvents) await _queueEvents.close();
  if (_connection) await _connection.quit();
}

export { getConnection as connection };
