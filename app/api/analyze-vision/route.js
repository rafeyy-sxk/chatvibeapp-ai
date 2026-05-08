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
import { generate } from "@/lib/ai";
import { z } from "zod";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  images: z.array(z.string()).min(1).max(10),
  customPrompt: z.string().max(500).optional(),
});

// Formats Groq vision accepts natively
const GROQ_NATIVE = /^image\/(jpeg|jpg|png|gif|webp)$/i;
// All formats we'll accept (non-native get converted by sharp)
const ACCEPTED_MIME = /^image\/(jpeg|jpg|png|gif|webp|avif|heic|heif|bmp)$/i;
const MAX_PX = 2048;

function parseMime(dataUrl) {
  if (dataUrl.startsWith("data:")) {
    return dataUrl.slice(5, dataUrl.indexOf(";"));
  }
  return "image/jpeg";
}

function parseBase64(dataUrl) {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

async function normalizeImage(dataUrl) {
  const mime = parseMime(dataUrl);
  const raw = parseBase64(dataUrl);
  let buf = Buffer.from(raw, "base64");
  let outMime = mime;

  // Convert non-native formats to JPEG
  if (!GROQ_NATIVE.test(mime)) {
    buf = await sharp(buf).jpeg({ quality: 85 }).toBuffer();
    outMime = "image/jpeg";
  }

  // Downsize if over MAX_PX (faster + stays under 4MB limit)
  const meta = await sharp(buf).metadata();
  if ((meta.width || 0) > MAX_PX || (meta.height || 0) > MAX_PX) {
    const format = outMime === "image/jpeg" ? "jpeg" : undefined;
    const resized = sharp(buf).resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true });
    buf = format === "jpeg"
      ? await resized.jpeg({ quality: 85 }).toBuffer()
      : await resized.toBuffer();
  }

  return `data:${outMime};base64,${buf.toString("base64")}`;
}

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
  // Validate MIME types and normalize (convert + resize) each image
  const normalized = await Promise.all(
    images.map(async (b64) => {
      const mime = parseMime(b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`);
      if (!ACCEPTED_MIME.test(mime)) {
        const err = new Error(`Unsupported image type: ${mime}`);
        err.code = "UNSUPPORTED_MIME";
        err.received = mime;
        throw err;
      }
      const dataUrl = b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
      return normalizeImage(dataUrl);
    })
  );

  const content = [
    ...normalized.map((url) => ({
      type: "image_url",
      image_url: { url },
    })),
    {
      type: "text",
      text: `Extract all chat messages from the image(s) above, then analyse the conversation.${
        customPrompt ? `\n\nAdditional focus: ${customPrompt}` : ""
      }\n\nRespond with the JSON object only.`,
    },
  ];

  const raw = await generate({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    temperature: 0.6,
    maxTokens: 1024,
    responseFormat: { type: "json_object" },
  });
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

    if (error.code === "UNSUPPORTED_MIME") {
      return applySecurityHeaders(
        NextResponse.json({
          data: null,
          error: {
            code: "UNSUPPORTED_MIME",
            message: `Image type "${error.received}" is not supported. Try JPEG, PNG, WebP, GIF, AVIF, or HEIC.`,
            received: error.received,
            allowed: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif", "image/bmp"],
          },
          status: "error",
        }, { status: 400 })
      );
    }

    return applySecurityHeaders(
      NextResponse.json(
        { error: `Analysis failed: ${error.message || "Please try again."}` },
        { status: 500 }
      )
    );
  }
}
