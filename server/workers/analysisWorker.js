/**
 * Analysis Worker - Processes analysis jobs from queue
 * Handles image OCR via Tesseract.js and AI analysis via Gemini API
 */

import { createWorker } from "tesseract.js";
import { runAnalysisEngine } from "../src/services/analysisEngine.js";
import prisma from "../../lib/prisma.js";
import { getCachedAnalysis, setCachedAnalysis } from "../../lib/cache/index.js";
import { log } from "../../lib/logger/index.js";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Run OCR on a base64-encoded image using Tesseract.js
 */
async function ocrBase64Image(base64) {
  // Tesseract.js v6 accepts data URIs or Buffers directly
  const dataUri = base64.startsWith("data:")
    ? base64
    : `data:image/png;base64,${base64}`;

  const langDataPath = path.resolve(__dirname, "../../");
  const worker = await createWorker("eng", 1, {
    langPath: langDataPath,
    logger: () => {},
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(dataUri);
    return text || "";
  } finally {
    await worker.terminate();
  }
}

/**
 * Call Gemini API for analysis
 */
async function callGeminiAPI(combinedText, customPrompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = `🔒 SYSTEM PROMPT (ChatVibe AI – Final Version)

You are ChatVibe AI, a specialized conversational-behavior analysis model.
Your job is to analyze digital conversations (text messages, WhatsApp, Instagram DM, iMessage screenshots, or plain text) and detect emotional tone, communication patterns, interpersonal dynamics, and behavioral signals.

Always follow these rules:

1. Output Format (IMPORTANT)

You must always respond in valid JSON only, using the exact structure below:

{
  "summary": "",
  "overall_vibe": "",
  "metrics": {
    "flirty": 0,
    "passive_aggressive": 0,
    "friendly": 0,
    "romantic": 0,
    "dry_energy": 0,
    "angry": 0,
    "confused": 0
  },
  "personality_traits": [],
  "behavior_flags": [],
  "advice": ""
}

Every field must always exist.
Percentages must be integers (0–100).
Total does NOT need to equal 100; each metric is independent.
Output must be strictly JSON — no commentary, no markdown.

2. Analysis Rules

When analyzing chats:

Emotional Tone — Identify: flirtiness, passive aggression, anger, affection, emotional distance, sarcasm, confusion, dry/cold responses.

Behavior Patterns — Detect: mixed signals, avoidance, manipulation, over-communication, short replies, playful banter, defensive tone, submissive vs dominant energy.

Communication Style — Classify: clarity, emotional openness, humor, sarcasm, dismissiveness, validation vs invalidation.

3. Strictness Requirements

Never refuse analysis. Never moralize. Never warn about context or expertise.
Never output markdown or text outside the JSON. Never change the JSON format.

4. Special Instructions

If conversation text is short, still analyze it.
If the message includes slang or emojis, interpret them.
If the conversation seems one-sided, note imbalance.
${customPrompt ? `\n**Additional Instructions**: ${customPrompt}` : ""}

Chat conversation to analyze:
${combinedText}

Now provide your analysis in the exact JSON format specified above. Output ONLY valid JSON, no other text:`;

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Gemini API error: ${response.status} - ${errorData.error?.message || "Unknown error"}`
    );
  }

  const data = await response.json();
  const analysisText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!analysisText || analysisText.trim().length === 0) {
    throw new Error("Empty response from Gemini API");
  }

  const cleanedText = analysisText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);
    if (
      !parsed.summary ||
      !parsed.overall_vibe ||
      !parsed.metrics ||
      !Array.isArray(parsed.personality_traits) ||
      !Array.isArray(parsed.behavior_flags) ||
      !parsed.advice
    ) {
      throw new Error("Invalid response structure");
    }
    return parsed;
  } catch (parseError) {
    log.error("Failed to parse Gemini response", {
      error: parseError.message,
      response: cleanedText.substring(0, 500),
    });
    throw new Error(
      `Invalid JSON response from Gemini API: ${parseError.message}`
    );
  }
}

/**
 * Main job processor
 * job.data: { userId, images: string[], customPrompt: string, jobId: string }
 */
export async function processAnalysisJob(job) {
  // CRITICAL: BullMQ job.id !== DB job ID. Always use job.data.jobId for DB ops.
  const dbJobId = job.data.jobId;
  const { images, customPrompt, userId } = job.data;
  const startTime = Date.now();

  log.info("Processing analysis job", {
    queueJobId: job.id,
    dbJobId,
    userId,
    imageCount: images?.length || 0,
  });

  try {
    // Mark as processing in DB
    await prisma.analysisJob.update({
      where: { id: dbJobId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    await job.updateProgress(5);

    // Step 1: OCR each image (5-40%)
    log.info("Running OCR on images", { dbJobId, imageCount: images.length });
    await prisma.analysisJob.update({
      where: { id: dbJobId },
      data: { status: "OCR_IN_PROGRESS" },
    });

    const ocrTexts = [];
    for (let i = 0; i < images.length; i++) {
      const text = await ocrBase64Image(images[i]);
      ocrTexts.push(text.trim());
      const ocrProgress = 5 + Math.round(((i + 1) / images.length) * 35);
      await job.updateProgress(ocrProgress);
    }

    const combinedText = ocrTexts.filter(Boolean).join("\n\n");

    if (!combinedText.trim()) {
      throw new Error(
        "No text could be extracted from the uploaded images. Please ensure the screenshots are clear and readable."
      );
    }

    // Save extracted text to DB
    await prisma.analysisJob.update({
      where: { id: dbJobId },
      data: { inputText: combinedText },
    });

    await job.updateProgress(40);

    // Step 2: Internal analytics engine (40-55%)
    log.info("Running internal analytics", { dbJobId });
    const analytics = runAnalysisEngine(combinedText);
    await job.updateProgress(55);

    // Step 3: Gemini API analysis (55-90%) with caching
    const textHash = createHash("sha256")
      .update(combinedText + (customPrompt || ""))
      .digest("hex");
    let geminiSummary = await getCachedAnalysis(textHash);

    if (!geminiSummary) {
      log.info("Calling Gemini API", { dbJobId });
      await prisma.analysisJob.update({
        where: { id: dbJobId },
        data: { status: "ANALYSIS_IN_PROGRESS" },
      });

      await job.updateProgress(60);
      geminiSummary = await callGeminiAPI(combinedText, customPrompt);
      await job.updateProgress(90);

      // Cache result for 24h
      await setCachedAnalysis(textHash, geminiSummary, 86400);
    } else {
      log.info("Analysis cache hit", { dbJobId });
      await job.updateProgress(90);
    }

    // Step 4: Save report (90-100%)
    await job.updateProgress(95);
    const report = await prisma.analysisReport.create({
      data: {
        userId,
        jobId: dbJobId,
        rawText: combinedText,
        analyticsJson: analytics,
        geminiSummary,
      },
    });

    await prisma.analysisJob.update({
      where: { id: dbJobId },
      data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
    });

    await job.updateProgress(100);

    const duration = Date.now() - startTime;
    log.info("Analysis job completed", {
      dbJobId,
      reportId: report.id,
      duration,
    });

    return { reportId: report.id, analysis: geminiSummary, analytics };
  } catch (error) {
    log.error("Analysis job failed", { error: error.message, dbJobId, userId });

    await prisma.analysisJob.update({
      where: { id: dbJobId },
      data: {
        status: "FAILED",
        errorMessage: error.message,
        failedAt: new Date(),
      },
    });

    throw error;
  }
}
