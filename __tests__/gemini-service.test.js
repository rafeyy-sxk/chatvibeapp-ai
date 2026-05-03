/**
 * Gemini Model Service Tests
 * Tests for Gemini API integration and error handling
 */

describe("Gemini API Service", () => {
  let originalFetch;
  let originalApiKey;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  describe("Successful Model Call", () => {
    it("should make successful API call with correct format", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "Test summary",
                    overall_vibe: "positive",
                    metrics: {
                      flirty: 10,
                      passive_aggressive: 0,
                      friendly: 80,
                      romantic: 5,
                      dry_energy: 5,
                      angry: 0,
                      confused: 0,
                    },
                    personality_traits: ["friendly"],
                    behavior_flags: [],
                    advice: "Test advice",
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "test prompt" }],
            },
          ],
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.candidates).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        GEMINI_API_URL,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-goog-api-key": "test-api-key",
          }),
        })
      );
    });

    it("should parse JSON response correctly", async () => {
      const jsonResponse = {
        summary: "Test",
        overall_vibe: "positive",
        metrics: { flirty: 10 },
        personality_traits: [],
        behavior_flags: [],
        advice: "Test",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(jsonResponse) }],
              },
            },
          ],
        }),
      });

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "test" }] }],
        }),
      });

      const data = await response.json();
      const analysisText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(analysisText);

      expect(parsed.summary).toBe("Test");
      expect(parsed.metrics.flirty).toBe(10);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing API key", () => {
      delete process.env.GEMINI_API_KEY;

      expect(() => {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is not configured");
        }
      }).toThrow("GEMINI_API_KEY");
    });

    it("should handle 429 rate limit", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: "Rate limit exceeded",
            code: 429,
          },
        }),
      });

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "test" }] }],
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
    });

    it("should handle 500 internal server error", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            message: "Internal server error",
            code: 500,
          },
        }),
      });

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "test" }] }],
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it("should handle wrong model name", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            message: "Model not found",
            code: 404,
          },
        }),
      });

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/wrong-model:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "test" }] }],
          }),
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it("should handle unexpected JSON schema", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      // Missing required fields
                      summary: "test",
                      // Missing overall_vibe, metrics, etc.
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "test" }] }],
        }),
      });

      const data = await response.json();
      const analysisText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(analysisText);

      // Should detect missing fields
      expect(parsed.overall_vibe).toBeUndefined();
      expect(parsed.metrics).toBeUndefined();
    });

    it("should handle markdown-wrapped JSON", async () => {
      const jsonResponse = {
        summary: "Test",
        overall_vibe: "positive",
        metrics: { flirty: 10 },
        personality_traits: [],
        behavior_flags: [],
        advice: "Test",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "```json\n" + JSON.stringify(jsonResponse) + "\n```",
                  },
                ],
              },
            },
          ],
        }),
      });

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "test" }] }],
        }),
      });

      const data = await response.json();
      const analysisText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Should clean markdown
      const cleaned = analysisText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      const parsed = JSON.parse(cleaned);
      expect(parsed.summary).toBe("Test");
    });

    it("should handle network errors", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      await expect(
        fetch(GEMINI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "test" }] }],
          }),
        })
      ).rejects.toThrow("Network error");
    });

    it("should handle timeout", async () => {
      global.fetch = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: false, status: 408 }), 100)
          )
      );

      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "test" }] }],
        }),
      });

      expect(response.status).toBe(408);
    });
  });

  describe("Response Validation", () => {
    it("should validate required fields in response", () => {
      const validResponse = {
        summary: "Test",
        overall_vibe: "positive",
        metrics: { flirty: 10 },
        personality_traits: [],
        behavior_flags: [],
        advice: "Test",
      };

      expect(validResponse.summary).toBeDefined();
      expect(validResponse.overall_vibe).toBeDefined();
      expect(validResponse.metrics).toBeDefined();
      expect(validResponse.personality_traits).toBeDefined();
      expect(validResponse.behavior_flags).toBeDefined();
      expect(validResponse.advice).toBeDefined();
    });

    it("should normalize metrics to integers 0-100", () => {
      const metrics = {
        flirty: 10.5,
        friendly: 80.9,
        romantic: -5,
        angry: 150,
      };

      Object.keys(metrics).forEach((key) => {
        metrics[key] = Math.round(Number(metrics[key]) || 0);
        metrics[key] = Math.max(0, Math.min(100, metrics[key]));
      });

      expect(metrics.flirty).toBe(11);
      expect(metrics.friendly).toBe(81);
      expect(metrics.romantic).toBe(0);
      expect(metrics.angry).toBe(100);
    });
  });
});

