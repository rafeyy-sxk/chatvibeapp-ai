/**
 * POST /api/analyze-text
 * Receives OCR-extracted text from the browser, calls Groq, saves report.
 * No Redis, no worker, no queue — works everywhere including Vercel serverless.
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import prisma from "@/lib/prisma";
import { runAnalysisEngine } from "@/server/src/services/analysisEngine";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const schema = z.object({
  text: z.string().min(1, "No text provided").max(50000, "Text too long"),
  customPrompt: z.string().max(500).optional(),
});

async function callGroq(text, customPrompt) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const systemPrompt = `You are ChatVibe AI, a conversational-behavior analysis model.
Analyze digital conversations and detect emotional tone, communication patterns, and behavioral signals.
You MUST respond with valid JSON only — no markdown, no commentary, no extra text.
Use this exact structure:
{
  "summary": "string",
  "overall_vibe": "string",
  "metrics": {
    "flirty": 0-100,
    "passive_aggressive": 0-100,
    "friendly": 0-100,
    "romantic": 0-100,
    "dry_energy": 0-100,
    "angry": 0-100,
    "confused": 0-100
  },
  "personality_traits": ["string"],
  "behavior_flags": ["string"],
  "advice": "string"
}`;

  const userPrompt = `${customPrompt ? `Additional focus: ${customPrompt}\n\n` : ""}Chat conversation to analyze:\n${text}\n\nRespond with JSON only.`;

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
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

  const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());

  if (!parsed.summary || !parsed.overall_vibe || !parsed.metrics) {
    throw new Error("Invalid JSON structure from Groq");
  }

  return parsed;
}

export async function POST(request) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    let userId;
    try {
      const payload = verifyAccessToken(authHeader.slice(7));
      userId = payload.sub;
    } catch {
      return applySecurityHeaders(NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }));
    }

    // Validate body
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
      );
    }

    const { text, customPrompt } = parsed.data;

    // Check user exists + free subscription check (create one if none)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return applySecurityHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }));
    }

    // Ensure billing record exists (upsert free tier)
    let billingCustomer = await prisma.billingCustomer.findUnique({ where: { userId } });
    if (!billingCustomer) {
      billingCustomer = await prisma.billingCustomer.create({
        data: { userId, email: user.email },
      });
    }

    // Create job record
    const job = await prisma.analysisJob.create({
      data: {
        userId,
        status: "PROCESSING",
        progress: 0,
        inputText: text,
        customPrompt: customPrompt || null,
        priority: 5,
        startedAt: new Date(),
      },
    });

    // Run internal analytics
    const analytics = runAnalysisEngine(text);

    // Call Groq
    const geminiSummary = await callGroq(text, customPrompt); // field name kept for DB compat

    // Save report
    const report = await prisma.analysisReport.create({
      data: {
        userId,
        jobId: job.id,
        rawText: text,
        analyticsJson: analytics,
        geminiSummary, // stored as JSON, field name is legacy
      },
    });

    // Mark job complete
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
    });

    return applySecurityHeaders(
      NextResponse.json({
        reportId: report.id,
        jobId: job.id,
        analysis: geminiSummary,
        analytics,
      })
    );
  } catch (error) {
    console.error("[analyze-text]", error.message);
    return applySecurityHeaders(
      NextResponse.json(
        {
          error: "Analysis failed",
          message: process.env.NODE_ENV === "development" ? error.message : "Please try again.",
        },
        { status: 500 }
      )
    );
  }
}
