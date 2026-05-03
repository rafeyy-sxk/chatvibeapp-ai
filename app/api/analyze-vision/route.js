/**
 * POST /api/analyze-vision
 * Sends images directly to Groq vision model (llama-4-scout).
 * No OCR step — model reads text from screenshots AND analyses in one call.
 * Target: 2-4 seconds end to end.
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const schema = z.object({
  images: z.array(z.string()).min(1).max(10),
  customPrompt: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are ChatVibe AI. Read chat screenshots and return a JSON analysis.

REQUIRED OUTPUT FORMAT (JSON only, no markdown, no extra text):
{
  "summary": "2-3 sentences describing the conversation",
  "overall_vibe": "short punchy label like 'Tense but playful' or 'Distant and avoidant'",
  "metrics": {
    "flirty": 45,
    "passive_aggressive": 30,
    "friendly": 70,
    "romantic": 20,
    "dry_energy": 55,
    "angry": 10,
    "confused": 5
  },
  "personality_traits": ["Direct communicator", "Emotionally guarded"],
  "behavior_flags": ["Mixed signals", "Avoidant patterns"],
  "advice": "One paragraph of honest, actionable relationship advice."
}

STRICT RULES:
- metric values MUST be whole integers between 0 and 100 (NOT decimals, NOT 0-1 scale)
- personality_traits MUST be a JSON array of strings
- behavior_flags MUST be a JSON array of strings
- Output ONLY the JSON — zero extra text before or after`;

async function callGroqVision(images, customPrompt) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  // Build content array: all images + text prompt
  const content = [
    ...images.map((b64) => ({
      type: "image_url",
      image_url: {
        url: b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`,
      },
    })),
    {
      type: "text",
      text: `Extract all chat messages from the image(s) above, then analyse the conversation.${
        customPrompt ? `\n\nAdditional focus: ${customPrompt}` : ""
      }\n\nRespond with the JSON object only.`,
    },
  ];

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      temperature: 0.6,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq API error ${res.status}: ${err?.error?.message || "Unknown"}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty response from Groq");

  const parsed = JSON.parse(
    raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  );

  if (!parsed.summary || !parsed.overall_vibe || !parsed.metrics) {
    throw new Error("Invalid JSON structure from Groq");
  }

  // Normalize metrics: model may return 0-1 floats instead of 0-100 integers
  const METRIC_KEYS = ["flirty", "passive_aggressive", "friendly", "romantic", "dry_energy", "angry", "confused"];
  const metrics = {};
  for (const key of METRIC_KEYS) {
    let val = Number(parsed.metrics[key]) || 0;
    // If all values are <= 1, they're 0-1 scale — convert to 0-100
    if (val <= 1) val = Math.round(val * 100);
    metrics[key] = Math.min(100, Math.max(0, Math.round(val)));
  }

  // Normalize arrays (model sometimes returns objects)
  const toArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return Object.values(v);
    return [];
  };

  return {
    summary: String(parsed.summary || ""),
    overall_vibe: String(parsed.overall_vibe || ""),
    metrics,
    personality_traits: toArray(parsed.personality_traits).map(String),
    behavior_flags: toArray(parsed.behavior_flags).map(String),
    advice: String(parsed.advice || ""),
  };
}

export async function POST(request) {
  try {
    // Auth
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    let userId;
    try {
      const payload = verifyAccessToken(authHeader.slice(7));
      userId = payload.sub;
    } catch {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 }
        )
      );
    }

    const { images, customPrompt } = parsed.data;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return applySecurityHeaders(
        NextResponse.json({ error: "User not found" }, { status: 404 })
      );
    }

    // Create job record
    const job = await prisma.analysisJob.create({
      data: {
        userId,
        status: "PROCESSING",
        progress: 0,
        imageCount: images.length,
        priority: 5,
        startedAt: new Date(),
      },
    });

    // Call Groq vision — reads text + analyses in one shot
    const analysis = await callGroqVision(images, customPrompt);

    // Save report
    const report = await prisma.analysisReport.create({
      data: {
        userId,
        jobId: job.id,
        rawText: `[Vision analysis of ${images.length} image(s)]`,
        analyticsJson: {},
        geminiSummary: analysis,
      },
    });

    // Mark job done
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
    });

    return applySecurityHeaders(
      NextResponse.json({ reportId: report.id, analysis })
    );
  } catch (error) {
    console.error("[analyze-vision]", error.message);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Analysis failed. Please try again." },
        { status: 500 }
      )
    );
  }
}
