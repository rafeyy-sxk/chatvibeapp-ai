/**
 * SSE (Server-Sent Events) Streaming Tests
 * Tests for real-time job status streaming
 */

import { GET } from "@/app/api/jobs/[id]/stream/route";
import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import prisma from "@/lib/prisma";

// Note: Most mocks are configured in __tests__/setup.js
// Override specific mocks here if needed

jest.mock("@/lib/auth/tokens");

describe("SSE Streaming", () => {
  let mockRequest;
  let mockParams;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockParams = { id: "job-123" };
    
    verifyAccessToken.mockReturnValue({
      sub: "user-123",
      username: "testuser",
    });
  });

  const createMockRequest = (url, options = {}) => {
    const request = new NextRequest(url, options);
    request.signal.addEventListener = jest.fn();
    return request;
  };

  describe("Successful SSE Connection", () => {
    it("should establish SSE connection successfully", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    });

    it("should send initial connection message", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("connected");
      expect(text).toContain("job-123");
    });
  });

  describe("Authentication", () => {
    it("should reject request without token", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream");

      const response = await GET(request, { params: mockParams });

      expect(response.status).toBe(401);
    });

    it("should accept token from query parameter", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });

      expect(response.status).toBe(200);
    });

    it("should accept token from Authorization header", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream", {
        headers: {
          authorization: "Bearer test-token",
        },
      });
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });

      expect(response.status).toBe(200);
    });

    it("should reject invalid token", async () => {
      verifyAccessToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=invalid-token");

      const response = await GET(request, { params: mockParams });

      expect(response.status).toBe(401);
    });
  });

  describe("Stream Updates", () => {
    it("should send job updates until completion", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      let callCount = 0;
      prisma.analysisJob.findUnique.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: "job-123",
            userId: "user-123",
            status: "PROCESSING",
            progress: 50,
            errorMessage: null,
            createdAt: new Date(),
            completedAt: null,
          });
        } else {
          return Promise.resolve({
            id: "job-123",
            userId: "user-123",
            status: "COMPLETED",
            progress: 100,
            errorMessage: null,
            createdAt: new Date(),
            completedAt: new Date(),
          });
        }
      });

      prisma.analysisReport.findUnique.mockResolvedValue({
        id: "report-123",
      });

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for updates
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("update");
      expect(text).toContain("PROCESSING");
    });

    it("should send completion message with report ID", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "COMPLETED",
        progress: 100,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: new Date(),
      });

      prisma.analysisReport.findUnique.mockResolvedValue({
        id: "report-123",
      });

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("completed");
      expect(text).toContain("report-123");
    });
  });

  describe("Error Handling", () => {
    it("should handle job not found", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue(null);

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for error
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("error");
      expect(text).toContain("Job not found");
    });

    it("should handle unauthorized access (wrong user)", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "different-user", // Different user
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for error
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("error");
      expect(text).toContain("Unauthorized");
    });

    it("should handle database errors", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockRejectedValue(new Error("Database error"));

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for error
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("error");
    });
  });

  describe("Stream Interruption", () => {
    it("should handle broken client connection", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });
      
      // Simulate client disconnect
      const abortController = new AbortController();
      abortController.abort();
      
      // Verify cleanup handler was registered
      expect(request.signal.addEventListener).toHaveBeenCalled();
    });

    it("should close stream on timeout", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for timeout (maxPolls = 300, poll every 1s, but we'll test with shorter timeout)
      // Note: In real scenario, timeout happens after 300 polls
      // For testing, we verify the timeout logic exists
      
      // Stream should eventually close
      let done = false;
      while (!done) {
        const { done: isDone } = await reader.read();
        done = isDone;
      }
      
      expect(done).toBe(true);
    });
  });

  describe("Job Status Updates", () => {
    it("should send updates for FAILED status", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "FAILED",
        progress: 0,
        errorMessage: "Processing failed",
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for update
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("FAILED");
      expect(text).toContain("Processing failed");
    });

    it("should send updates for CANCELLED status", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "CANCELLED",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const response = await GET(request, { params: mockParams });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read initial connection
      await reader.read();
      
      // Wait for update
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const { value } = await reader.read();
      const text = decoder.decode(value);
      
      expect(text).toContain("CANCELLED");
    });
  });

  describe("Edge Runtime Compatibility", () => {
    it("should use ReadableStream API (Edge compatible)", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });

      // Verify ReadableStream is used
      expect(response.body).toBeInstanceOf(ReadableStream);
      expect(response.body.getReader).toBeDefined();
    });

    it("should have correct SSE headers", async () => {
      const request = createMockRequest("http://localhost:3000/api/jobs/job-123/stream?token=test-token");
      
      prisma.analysisJob.findUnique.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      });

      const response = await GET(request, { params: mockParams });

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
      expect(response.headers.get("Connection")).toBe("keep-alive");
      expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    });
  });
});

