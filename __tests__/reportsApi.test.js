import { createMocks } from "node-mocks-http";
import { GET as getReports } from "@/app/api/reports/route";
import { GET as getReportById } from "@/app/api/reports/[id]/route";
import * as tokens from "@/lib/auth/tokens";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    analysisReport: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "r1",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          analyticsJson: { sentimentTimeline: [] },
          geminiSummary: { summary: "ok", overall_vibe: "balanced" },
        },
      ]),
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === "r1" && where.userId === "user-1") {
          return {
            id: "r1",
            createdAt: new Date("2024-01-01T00:00:00Z"),
            rawText: "hello",
            ocrTranscript: "hello",
            analyticsJson: { sentimentTimeline: [] },
            geminiSummary: { summary: "ok", overall_vibe: "balanced" },
          };
        }
        return null;
      }),
    },
  },
}));

describe("reports API", () => {
  const token = "test-token";
  const payload = { sub: "user-1", username: "tester" };

  beforeAll(() => {
    jest.spyOn(tokens, "verifyAccessToken").mockImplementation((t) => {
      if (t !== token) throw new Error("invalid");
      return payload;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("lists reports for the authenticated user", async () => {
    const { req, res } = createMocks({
      method: "GET",
      url: "http://localhost/api/reports",
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await getReports(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.reports)).toBe(true);
    expect(body.reports[0].id).toBe("r1");
  });

  it("returns a single report by id", async () => {
    const { req } = createMocks({
      method: "GET",
      url: "http://localhost/api/reports/r1",
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await getReportById(req, { params: { id: "r1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("r1");
    expect(body.analytics).toBeDefined();
  });
});


