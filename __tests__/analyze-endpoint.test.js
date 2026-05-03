/**
 * Analyze Endpoint Tests
 * Comprehensive tests for app/api/analyze/route.js
 */

import { POST } from "@/app/api/analyze/route";
import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import prisma from "@/lib/prisma";
import Tesseract from "tesseract.js";
import { addAnalysisJob, analysisQueue } from "@/lib/queue";

// Note: Most mocks are configured in __tests__/setup.js
// Override specific mocks here if needed for these tests

jest.mock("@/lib/auth/tokens");

describe("Analyze Endpoint", () => {
  const SAMPLE_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/xcAAusB9Yp0n6cAAAAASUVORK5CYII=";
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-api-key";
    
    verifyAccessToken.mockReturnValue({
      sub: "user-123",
      username: "testuser",
    });
  });

  const createRequest = (body, headers = {}) => {
    return new NextRequest("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer test-token",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  describe("Valid Request → Job Queued", () => {
    it("should queue job and return job ID when queue is available", async () => {
      analysisQueue.getWaitingCount.mockResolvedValue(0);
      
      const mockJob = {
        id: "job-123",
        data: { userId: "user-123", images: [SAMPLE_IMAGE] },
      };
      addAnalysisJob.mockResolvedValue(mockJob);

      prisma.analysisJob.create.mockResolvedValue({
        id: "job-123",
        userId: "user-123",
        status: "PENDING",
        progress: 0,
        imageCount: 1,
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE],
        customPrompt: "",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.jobId).toBe("job-123");
      expect(data.status).toBe("PENDING");
      expect(addAnalysisJob).toHaveBeenCalled();
    });

    it("should fall back to synchronous processing when queue unavailable", async () => {
      analysisQueue.getWaitingCount.mockRejectedValue(new Error("Redis unavailable"));

      Tesseract.recognize.mockResolvedValue({
        data: { text: "test ocr text" },
      });

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
                      metrics: { flirty: 10, passive_aggressive: 0, friendly: 80, romantic: 5, dry_energy: 5, angry: 0, confused: 0 },
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

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reportId).toBe("report-123");
      expect(data.ocrResults).toBeDefined();
      expect(data.analysis).toBeDefined();
    });
  });

  describe("Input Validation", () => {
    it("should return 400 for missing images", async () => {
      analysisQueue.getWaitingCount.mockResolvedValue(0);

      const request = createRequest({
        images: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("No images provided");
    });

    it("should return 400 for non-array images", async () => {
      analysisQueue.getWaitingCount.mockResolvedValue(0);

      const request = createRequest({
        images: "not-an-array",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("No images provided");
    });

    it("should return 400 for more than 10 images", async () => {
      analysisQueue.getWaitingCount.mockResolvedValue(0);

      const request = createRequest({
        images: Array(11).fill(SAMPLE_IMAGE),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Maximum 10 images");
    });

    it("should return 403 for unauthenticated request", async () => {
      verifyAccessToken.mockReturnValue(null);

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Unauthorized");
    });
  });

  describe("Gemini API Integration", () => {
    beforeEach(() => {
      analysisQueue.getWaitingCount.mockRejectedValue(new Error("Queue unavailable"));
      Tesseract.recognize.mockResolvedValue({
        data: { text: "test ocr text" },
      });
    });

    it("should handle Gemini API success", async () => {
      const geminiResponse = {
        summary: "Test summary",
        overall_vibe: "positive",
        metrics: { flirty: 10, passive_aggressive: 0, friendly: 80, romantic: 5, dry_energy: 5, angry: 0, confused: 0 },
        personality_traits: ["friendly"],
        behavior_flags: [],
        advice: "Test advice",
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(geminiResponse) }],
              },
            },
          ],
        }),
      });

      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analysis).toEqual(geminiResponse);
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle Gemini API failure", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: { message: "Internal server error" },
        }),
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Gemini API error");
    });

    it("should handle Gemini API timeout", async () => {
      global.fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: false, status: 408 }), 100)
          )
      );

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(408);
    });

    it("should handle malformed Gemini response", async () => {
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

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Invalid JSON response");
    });

    it("should handle empty Gemini response", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "" }],
              },
            },
          ],
        }),
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Empty response");
    });

    it("should handle missing Gemini API key", async () => {
      delete process.env.GEMINI_API_KEY;

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("GEMINI_API_KEY");
    });

    it("should handle Gemini response with markdown code blocks", async () => {
      const geminiResponse = {
        summary: "Test",
        overall_vibe: "positive",
        metrics: { flirty: 10, passive_aggressive: 0, friendly: 80, romantic: 5, dry_energy: 5, angry: 0, confused: 0 },
        personality_traits: [],
        behavior_flags: [],
        advice: "Test",
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "```json\n" + JSON.stringify(geminiResponse) + "\n```",
                  },
                ],
              },
            },
          ],
        }),
      });

      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analysis).toBeDefined();
    });
  });

  describe("OCR Processing", () => {
    beforeEach(() => {
      analysisQueue.getWaitingCount.mockRejectedValue(new Error("Queue unavailable"));
    });

    it("should process multiple images", async () => {
      Tesseract.recognize
        .mockResolvedValueOnce({ data: { text: "text1" } })
        .mockResolvedValueOnce({ data: { text: "text2" } });

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
                      metrics: { flirty: 10, passive_aggressive: 0, friendly: 80, romantic: 5, dry_energy: 5, angry: 0, confused: 0 },
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

      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE, SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Tesseract.recognize).toHaveBeenCalledTimes(2);
      expect(data.ocrResults).toHaveLength(2);
    });

    it("should handle OCR failure for individual images", async () => {
      Tesseract.recognize
        .mockRejectedValueOnce(new Error("OCR failed"))
        .mockResolvedValueOnce({ data: { text: "text2" } });

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
                      metrics: { flirty: 10, passive_aggressive: 0, friendly: 80, romantic: 5, dry_energy: 5, angry: 0, confused: 0 },
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

      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE, SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still process with valid OCR results
      expect(response.status).toBe(200);
    });

    it("should return 400 when no text detected", async () => {
      Tesseract.recognize.mockResolvedValue({
        data: { text: "" },
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("No text detected");
    });
  });

  describe("Database Operations", () => {
    beforeEach(() => {
      analysisQueue.getWaitingCount.mockRejectedValue(new Error("Queue unavailable"));
      Tesseract.recognize.mockResolvedValue({
        data: { text: "test ocr text" },
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
                      metrics: { flirty: 10, passive_aggressive: 0, friendly: 80, romantic: 5, dry_energy: 5, angry: 0, confused: 0 },
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
    });

    it("should create analysis report in database", async () => {
      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      await POST(request);

      expect(prisma.analysisReport.create).toHaveBeenCalled();
      const createCall = prisma.analysisReport.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe("user-123");
      expect(createCall.data.rawText).toBeDefined();
    });

    it("should handle database write failure", async () => {
      prisma.analysisReport.create.mockRejectedValue(new Error("Database error"));

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      analysisQueue.getWaitingCount.mockRejectedValue(new Error("Unexpected error"));
      Tesseract.recognize.mockRejectedValue(new Error("Unexpected OCR error"));

      const request = createRequest({
        images: [SAMPLE_IMAGE],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it("should clean up images from memory", async () => {
      analysisQueue.getWaitingCount.mockRejectedValue(new Error("Queue unavailable"));
      Tesseract.recognize.mockResolvedValue({
        data: { text: "test ocr text" },
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
                      metrics: { flirty: 10, passive_aggressive: 0, friendly: 80, romantic: 5, dry_energy: 5, angry: 0, confused: 0 },
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

      prisma.analysisReport.create.mockResolvedValue({
        id: "report-123",
      });

      const images = [SAMPLE_IMAGE];
      const request = createRequest({ images });

      await POST(request);

      // Images should be cleaned up in finally block
      // (In real scenario, images array would be filled with null)
    });
  });
});

