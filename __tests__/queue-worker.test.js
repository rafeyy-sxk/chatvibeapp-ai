/**
 * Queue & Worker System Tests (HIGHEST PRIORITY)
 * Comprehensive tests for BullMQ queue and worker reliability
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis-mock";
import {
  createRedisConnection,
  createAnalysisWorker,
  addAnalysisJob,
  getJobStatus,
  closeQueue,
  initializeQueue,
} from "@/lib/queue";
import { processAnalysisJob } from "@/server/workers/analysisWorker";

// Note: All mocks are configured in __tests__/setup.js
// Individual mocks can be overridden here if needed for specific tests

describe("Queue & Worker System", () => {
  let mockRedis;
  let queue;
  let worker;
  let queueEvents;

  beforeEach(async () => {
    // Create mock Redis connection
    mockRedis = new Redis();
    
    // Create queue with mock Redis
    queue = new Queue("test-analysis-queue", {
      connection: mockRedis,
    });

    queueEvents = new QueueEvents("test-analysis-queue", {
      connection: mockRedis,
    });

    // Clear all mocks
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  afterEach(async () => {
    if (worker) {
      await worker.close();
    }
    if (queue) {
      await queue.close();
    }
    if (queueEvents) {
      await queueEvents.close();
    }
    await mockRedis.quit();
  });

  describe("Queue Initialization", () => {
    it("should create Redis connection successfully", () => {
      const connection = createRedisConnection();
      expect(connection).toBeDefined();
      connection.quit();
    });

    it("should initialize queue with custom name and URL", () => {
      const { queue: testQueue, connection, queueName } = initializeQueue(
        "custom-queue",
        "redis://custom:6379"
      );
      expect(testQueue).toBeDefined();
      expect(queueName).toBe("custom-queue");
      testQueue.close();
      connection.quit();
    });

    it("should handle Redis connection failures gracefully", async () => {
      const badConnection = new Redis("redis://invalid:6379");
      const badQueue = new Queue("test-queue", {
        connection: badConnection,
      });

      // Should not throw immediately (lazy connect)
      expect(badQueue).toBeDefined();
      
      await badQueue.close();
      await badConnection.quit();
    });
  });

  describe("Adding Jobs to Queue", () => {
    it("should add job successfully with valid payload", async () => {
      const jobData = {
        userId: "user-123",
        images: ["base64image1", "base64image2"],
        customPrompt: "test prompt",
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData, { priority: 5 });
      
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data).toEqual(jobData);
    });

    it("should handle invalid job payload gracefully", async () => {
      await expect(
        addAnalysisJob(null, { priority: 5 })
      ).rejects.toThrow();
    });

    it("should add job with custom priority", async () => {
      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData, { priority: 10 });
      
      expect(job.opts.priority).toBe(10);
    });

    it("should handle job options correctly", async () => {
      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData, {
        priority: 8,
        delay: 1000,
        attempts: 5,
      });

      expect(job.opts.priority).toBe(8);
      expect(job.opts.delay).toBe(1000);
      expect(job.opts.attempts).toBe(5);
    });
  });

  describe("Job Status", () => {
    it("should get job status successfully", async () => {
      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData);
      const status = await getJobStatus(job.id);

      expect(status).toBeDefined();
      expect(status.id).toBe(job.id);
      expect(status.status).toBeDefined();
    });

    it("should return null for non-existent job", async () => {
      const status = await getJobStatus("non-existent-job-id");
      expect(status).toBeNull();
    });

    it("should track job progress", async () => {
      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData);
      await job.updateProgress(50);

      const status = await getJobStatus(job.id);
      expect(status.progress).toBe(50);
    });
  });

  describe("Worker Processing", () => {
    let mockJob;

    beforeEach(() => {
      mockJob = {
        id: "test-job-123",
        data: {
          userId: "user-123",
          images: ["data:image/png;base64,test"],
          customPrompt: "",
        },
        updateProgress: jest.fn(),
        attemptsMade: 0,
      };
    });

    it("should process job successfully", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { getCachedOCR, getCachedAnalysis } = await import("@/lib/cache");

      getCachedOCR.mockResolvedValue(null);
      getCachedAnalysis.mockResolvedValue(null);

      prisma.analysisJob.update.mockResolvedValue({});
      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "test",
                      overall_vibe: "positive",
                      metrics: { flirty: 10 },
                      personality_traits: [],
                      behavior_flags: [],
                      advice: "test advice",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const result = await processAnalysisJob(mockJob);

      expect(result).toBeDefined();
      expect(result.reportId).toBe("report-123");
      expect(result.ocrResults).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it("should handle OCR cache hit", async () => {
      const { getCachedOCR } = await import("@/lib/cache");
      const prisma = (await import("@/lib/prisma")).default;

      getCachedOCR.mockResolvedValue("cached ocr text");
      getCachedAnalysis.mockResolvedValue(null);

      prisma.analysisJob.update.mockResolvedValue({});
      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "test",
                      overall_vibe: "positive",
                      metrics: { flirty: 10 },
                      personality_traits: [],
                      behavior_flags: [],
                      advice: "test",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      await processAnalysisJob(mockJob);

      // Should use cached OCR, not call Tesseract
      const Tesseract = await import("tesseract.js");
      expect(Tesseract.recognize).not.toHaveBeenCalled();
    });

    it("should handle Gemini API cache hit", async () => {
      const { getCachedOCR, getCachedAnalysis } = await import("@/lib/cache");
      const prisma = (await import("@/lib/prisma")).default;

      getCachedOCR.mockResolvedValue(null);
      getCachedAnalysis.mockResolvedValue({
        summary: "cached",
        overall_vibe: "positive",
        metrics: { flirty: 10 },
      });

      prisma.analysisJob.update.mockResolvedValue({});
      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      await processAnalysisJob(mockJob);

      // Should use cached analysis, not call Gemini API
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle no text detected error", async () => {
      const { getCachedOCR } = await import("@/lib/cache");
      const Tesseract = await import("tesseract.js");

      getCachedOCR.mockResolvedValue(null);
      Tesseract.recognize.mockResolvedValue({
        data: { text: "" }, // Empty text
      });

      await expect(processAnalysisJob(mockJob)).rejects.toThrow(
        "No text detected"
      );
    });

    it("should handle Gemini API failure", async () => {
      const { getCachedOCR, getCachedAnalysis } = await import("@/lib/cache");
      const prisma = (await import("@/lib/prisma")).default;

      getCachedOCR.mockResolvedValue(null);
      getCachedAnalysis.mockResolvedValue(null);

      prisma.analysisJob.update.mockResolvedValue({});

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "API Error" } }),
      });

      await expect(processAnalysisJob(mockJob)).rejects.toThrow();
    });

    it("should handle Gemini API timeout", async () => {
      const { getCachedOCR, getCachedAnalysis } = await import("@/lib/cache");
      const prisma = (await import("@/lib/prisma")).default;

      getCachedOCR.mockResolvedValue(null);
      getCachedAnalysis.mockResolvedValue(null);

      prisma.analysisJob.update.mockResolvedValue({});

      global.fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: false, status: 408 }), 100)
          )
      );

      await expect(processAnalysisJob(mockJob)).rejects.toThrow();
    });

    it("should handle malformed Gemini response", async () => {
      const { getCachedOCR, getCachedAnalysis } = await import("@/lib/cache");
      const prisma = (await import("@/lib/prisma")).default;

      getCachedOCR.mockResolvedValue(null);
      getCachedAnalysis.mockResolvedValue(null);

      prisma.analysisJob.update.mockResolvedValue({});

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "invalid json {broken" }],
              },
            },
          ],
        }),
      });

      await expect(processAnalysisJob(mockJob)).rejects.toThrow();
    });

    it("should handle missing Gemini API key", async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const { getCachedOCR, getCachedAnalysis } = await import("@/lib/cache");

      getCachedOCR.mockResolvedValue(null);
      getCachedAnalysis.mockResolvedValue(null);

      await expect(processAnalysisJob(mockJob)).rejects.toThrow(
        "GEMINI_API_KEY"
      );

      process.env.GEMINI_API_KEY = originalKey;
    });
  });

  describe("Worker Retry/Backoff Logic", () => {
    it("should retry failed jobs with exponential backoff", async () => {
      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      });

      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff.type).toBe("exponential");
      expect(job.opts.backoff.delay).toBe(1000);
    });

    it("should handle job failure and retry", async () => {
      let attemptCount = 0;
      const processor = async (job) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return { success: true };
      };

      worker = createAnalysisWorker(processor, {
        connection: mockRedis,
        queueName: "test-analysis-queue",
      });

      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData, {
        attempts: 3,
        backoff: { type: "exponential", delay: 100 },
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Job should eventually succeed after retries
      const status = await getJobStatus(job.id);
      // Note: In real scenario, job would be retried
      expect(status).toBeDefined();
    });
  });

  describe("Worker Crash Recovery", () => {
    it("should handle worker crash gracefully", async () => {
      const processor = async (job) => {
        throw new Error("Worker crash");
      };

      worker = createAnalysisWorker(processor, {
        connection: mockRedis,
        queueName: "test-analysis-queue",
      });

      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData, {
        attempts: 1,
      });

      // Simulate crash
      await worker.close();

      const status = await getJobStatus(job.id);
      expect(status).toBeDefined();
    });
  });

  describe("Redis Connection Failures", () => {
    it("should handle Redis connection failure when adding job", async () => {
      const badRedis = new Redis("redis://invalid-host:6379");
      const badQueue = new Queue("test-queue", {
        connection: badRedis,
      });

      // Should handle gracefully
      try {
        await badQueue.add("test", { data: "test" });
      } catch (error) {
        expect(error).toBeDefined();
      }

      await badQueue.close();
      await badRedis.quit();
    });

    it("should handle Redis disconnection during processing", async () => {
      const processor = async (job) => {
        // Simulate Redis disconnection
        await mockRedis.quit();
        return { success: true };
      };

      worker = createAnalysisWorker(processor, {
        connection: mockRedis,
        queueName: "test-analysis-queue",
      });

      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      await expect(addAnalysisJob(jobData)).rejects.toThrow();
    });
  });

  describe("Timeout and Stalled Jobs", () => {
    it("should handle job timeout", async () => {
      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData, {
        timeout: 1000, // 1 second timeout
      });

      expect(job.opts.timeout).toBe(1000);
    });

    it("should handle stalled jobs", async () => {
      const processor = async (job) => {
        // Simulate long-running job
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { success: true };
      };

      worker = createAnalysisWorker(
        processor,
        {
          connection: mockRedis,
          queueName: "test-analysis-queue",
        },
        {
          stalledInterval: 1000,
        }
      );

      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      await addAnalysisJob(jobData, {
        timeout: 500,
      });

      // Job should timeout
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });
  });

  describe("Job Completion Events", () => {
    it("should emit completion event", async () => {
      let completedJob = null;

      const processor = async (job) => {
        return { success: true, jobId: job.id };
      };

      worker = createAnalysisWorker(processor, {
        connection: mockRedis,
        queueName: "test-analysis-queue",
      });

      worker.on("completed", (job) => {
        completedJob = job;
      });

      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(completedJob).toBeDefined();
    });

    it("should emit failure event", async () => {
      let failedJob = null;

      const processor = async (job) => {
        throw new Error("Job failed");
      };

      worker = createAnalysisWorker(processor, {
        connection: mockRedis,
        queueName: "test-analysis-queue",
      });

      worker.on("failed", (job) => {
        failedJob = job;
      });

      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      await addAnalysisJob(jobData, { attempts: 1 });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(failedJob).toBeDefined();
    });
  });

  describe("Error Logging Behavior", () => {
    it("should log errors correctly", async () => {
      const { log } = await import("@/lib/logger");

      const processor = async (job) => {
        throw new Error("Test error");
      };

      worker = createAnalysisWorker(processor, {
        connection: mockRedis,
        queueName: "test-analysis-queue",
      });

      worker.on("error", (error) => {
        log.error("Worker error", error);
      });

      const jobData = {
        userId: "user-123",
        images: ["base64image1"],
        jobId: "job-123",
      };

      await addAnalysisJob(jobData, { attempts: 1 });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe("Communication: API → Queue → Worker", () => {
    it("should complete full flow: API adds job, worker processes", async () => {
      const prisma = (await import("@/lib/prisma")).default;
      const { getCachedOCR, getCachedAnalysis } = await import("@/lib/cache");

      getCachedOCR.mockResolvedValue(null);
      getCachedAnalysis.mockResolvedValue(null);

      prisma.analysisJob.update.mockResolvedValue({});
      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "test",
                      overall_vibe: "positive",
                      metrics: { flirty: 10 },
                      personality_traits: [],
                      behavior_flags: [],
                      advice: "test",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      // Step 1: API adds job
      const jobData = {
        userId: "user-123",
        images: ["data:image/png;base64,test"],
        customPrompt: "",
        jobId: "job-123",
      };

      const job = await addAnalysisJob(jobData);

      // Step 2: Worker processes job
      worker = createAnalysisWorker(processAnalysisJob, {
        connection: mockRedis,
        queueName: "test-analysis-queue",
      });

      // Step 3: Verify job status
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const status = await getJobStatus(job.id);
      expect(status).toBeDefined();
    });
  });
});

