/**
 * Lightweight smoke test that the analytics dashboard module loads and can render
 * with minimal props. Uses jsdom environment for React/DOM.
 *
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import AnalysisDetailPage from "@/app/analysis/[id]/page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "r1" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    id: "r1",
    createdAt: new Date().toISOString(),
    rawText: "hello",
    ocrTranscript: "hello",
    analytics: {
      sentimentTimeline: [{ index: 0, sentiment: 0.5 }],
      toxicity: { perMessage: [{ index: 0, score: 0 }], average: 0, spikes: [] },
      dominance: { speakers: { A: 60, B: 40 }, notes: "" },
      keywordClusters: [{ keyword: "hello", count: 3 }],
      behaviorFlags: { anxious: false, avoidant: false, manipulation: false, clinginess: false, indifference: false, inconsistency: false, details: [] },
    },
    geminiSummary: {
      summary: "ok",
      overall_vibe: "balanced",
      metrics: { friendly: 80 },
      behavior_flags: [],
      advice: "keep going",
      personality_traits: [],
    },
  }),
});

describe("AnalysisDetailPage", () => {
  it("renders without crashing and shows Gemini summary heading", async () => {
    // sessionStorage shim for the component
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: () => "test-access-token",
        setItem: () => {},
        removeItem: () => {},
      },
      writable: true,
    });

    const { findByText } = render(<AnalysisDetailPage />);
    const heading = await findByText(/Gemini summary/i);
    expect(heading).toBeInTheDocument();
  });
});


