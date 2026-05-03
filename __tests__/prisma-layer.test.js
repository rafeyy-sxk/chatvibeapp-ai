/**
 * Prisma Layer Tests
 * Tests for database operations and error handling
 */

import prisma from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    analysisJob: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    analysisReport: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe("Prisma Layer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Successful Database Operations", () => {
    it("should create analysis job successfully", async () => {
      const jobData = {
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        imageCount: 2,
        priority: 5,
      };

      prisma.analysisJob.create.mockResolvedValue({
        id: "job-123",
        ...jobData,
        createdAt: new Date(),
      });

      const result = await prisma.analysisJob.create({
        data: jobData,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("job-123");
      expect(prisma.analysisJob.create).toHaveBeenCalledWith({
        data: jobData,
      });
    });

    it("should update analysis job successfully", async () => {
      prisma.analysisJob.update.mockResolvedValue({
        id: "job-123",
        status: "COMPLETED",
        progress: 100,
      });

      const result = await prisma.analysisJob.update({
        where: { id: "job-123" },
        data: { status: "COMPLETED", progress: 100 },
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.progress).toBe(100);
    });

    it("should find unique record", async () => {
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
      });

      const result = await prisma.analysisJob.findUnique({
        where: { id: "job-123" },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("job-123");
    });
  });

  describe("Error Handling", () => {
    it("should handle unique constraint violation", async () => {
      const error = new Error("Unique constraint failed");
      error.code = "P2002";

      prisma.user.create.mockRejectedValue(error);

      await expect(
        prisma.user.create({
          data: {
            username: "existing-user",
            email: "test@example.com",
            passwordHash: "hash",
          },
        })
      ).rejects.toThrow();

      expect(error.code).toBe("P2002");
    });

    it("should handle foreign key violation", async () => {
      const error = new Error("Foreign key constraint failed");
      error.code = "P2003";

      prisma.analysisJob.create.mockRejectedValue(error);

      await expect(
        prisma.analysisJob.create({
          data: {
            userId: "non-existent-user",
            status: "PENDING",
            progress: 0,
            imageCount: 1,
          },
        })
      ).rejects.toThrow();

      expect(error.code).toBe("P2003");
    });

    it("should handle missing field error", async () => {
      const error = new Error("Required field missing");
      error.code = "P2009";

      prisma.analysisJob.create.mockRejectedValue(error);

      await expect(
        prisma.analysisJob.create({
          data: {
            // Missing required fields
            userId: "user-123",
          },
        })
      ).rejects.toThrow();
    });

    it("should handle transaction rollback", async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        try {
          return await callback(prisma);
        } catch (error) {
          // Transaction rollback
          throw error;
        }
      });

      prisma.analysisJob.create.mockRejectedValue(new Error("Transaction failed"));

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.analysisJob.create({
            data: {
              userId: "user-123",
              status: "PENDING",
              progress: 0,
              imageCount: 1,
            },
          });
        })
      ).rejects.toThrow("Transaction failed");
    });

    it("should handle transient database errors with retry", async () => {
      let attemptCount = 0;
      const transientError = new Error("Connection timeout");
      transientError.code = "P1008";

      prisma.analysisJob.create.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw transientError;
        }
        return { id: "job-123", userId: "user-123" };
      });

      // Simulate retry logic
      let result;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          result = await prisma.analysisJob.create({
            data: {
              userId: "user-123",
              status: "PENDING",
              progress: 0,
              imageCount: 1,
            },
          });
          break;
        } catch (error) {
          if (error.code === "P1008" && retries < maxRetries - 1) {
            retries++;
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          }
          throw error;
        }
      }

      expect(result).toBeDefined();
      expect(result.id).toBe("job-123");
    });

    it("should handle null return scenarios", async () => {
      prisma.analysisJob.findUnique.mockResolvedValue(null);

      const result = await prisma.analysisJob.findUnique({
        where: { id: "non-existent-id" },
      });

      expect(result).toBeNull();
    });
  });

  describe("Transaction Support", () => {
    it("should execute transaction successfully", async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      prisma.analysisJob.create.mockResolvedValue({
        id: "job-123",
      });

      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      const result = await prisma.$transaction(async (tx) => {
        const job = await tx.analysisJob.create({
          data: {
            userId: "user-123",
            status: "PENDING",
            progress: 0,
            imageCount: 1,
          },
        });

        const report = await tx.analysisReport.create({
          data: {
            userId: "user-123",
            jobId: job.id,
            rawText: "test",
            analyticsJson: {},
            geminiSummary: {},
          },
        });

        return { job, report };
      });

      expect(result.job.id).toBe("job-123");
      expect(result.report.id).toBe("report-123");
    });
  });
});

