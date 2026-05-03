import { runAnalysisEngine } from "@/server/src/services/analysisEngine";

describe("analysisEngine", () => {
  it("returns a structured analytics object", () => {
    const text = `
      A: hey, are you mad at me?
      B: no, I'm just tired lol
      A: okay, sorry if I was annoying
      B: it's fine
    `;

    const result = runAnalysisEngine(text);

    expect(result).toHaveProperty("sentimentTimeline");
    expect(Array.isArray(result.sentimentTimeline)).toBe(true);

    expect(result).toHaveProperty("toxicity");
    expect(result.toxicity).toHaveProperty("average");
    expect(Array.isArray(result.toxicity.perMessage)).toBe(true);

    expect(result).toHaveProperty("responsiveness");
    expect(result.responsiveness).toHaveProperty("messageCount");
    expect(typeof result.responsiveness.messageCount).toBe("number");

    expect(result).toHaveProperty("dominance");
    expect(result.dominance).toHaveProperty("speakers");

    expect(Array.isArray(result.keywordClusters)).toBe(true);
    expect(result).toHaveProperty("behaviorFlags");
    expect(result.behaviorFlags).toHaveProperty("anxious");
    expect(typeof result.behaviorFlags.anxious).toBe("boolean");

    // New PII detection fields
    expect(result).toHaveProperty("piiDetected");
    expect(result).toHaveProperty("sanitizedText");
    expect(typeof result.sanitizedText).toBe("string");
  });
});


