import { POST } from "@/app/api/analyze/route";
import { generateAccessToken } from "@/lib/auth/tokens";
import { NextRequest } from "next/server";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    analysisReport: {
      create: jest.fn().mockResolvedValue({
        id: "report-1",
      }),
    },
  },
}));

jest.mock("tesseract.js", () => ({
  recognize: jest.fn().mockResolvedValue({ data: { text: "hello world" } }),
}));

const SAMPLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/xcAAusB9Yp0n6cAAAAASUVORK5CYII=";

const buildAnalysis = () => ({
  summary: "ok",
  overall_vibe: "balanced",
  metrics: {
    flirty: 10,
    passive_aggressive: 0,
    friendly: 80,
    romantic: 5,
    dry_energy: 5,
    angry: 0,
    confused: 0,
  },
  personality_traits: ["observant"],
  behavior_flags: ["healthy"],
  advice: "Keep chatting",
});

describe("Image privacy", () => {
  beforeAll(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(buildAnalysis()) }] } }],
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    const request = new NextRequest("http://localhost:3000/api/analyze", {
      method: "POST",
      body: JSON.stringify({ images: [SAMPLE_IMAGE] }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/unauthorized/i);
  });

  it("processes images in memory for authorized users", async () => {
    const token = generateAccessToken({ sub: "user-123", username: "phase1" });
    const request = new NextRequest("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ images: [SAMPLE_IMAGE], customPrompt: "" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.username).toBe("phase1");
    expect(data.ocrResults).toEqual(["hello world"]);
    expect(data.analysis.overall_vibe).toBe("balanced");
    expect(data.analytics).toBeDefined();
    expect(data.reportId).toBe("report-1");
    // Note: Images are cleaned up in the route handler's finally block
  });
});

