import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractUserFromRequest } from "@/lib/auth/tokens";
import { generateStream, generate, vibePrompt, healthCheck } from "@/lib/ai";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function buildAnalysisPrompt(text, customPrompt) {
  const base = `You are an expert conversation analyst. Analyze the following text extracted from an image.

Provide a structured analysis covering:
1. Overall sentiment and emotional tone
2. Key behavioral patterns detected
3. Relationship dynamics (if applicable)
4. Notable language patterns or flags
5. Confidence assessment

Text to analyze:
---
${text}
---`;
  return customPrompt ? `${base}\n\nAdditional focus: ${customPrompt}` : base;
}

async function generateAndStoreVibe(jobId, text) {
  try {
    const prompt = vibePrompt(text);
    const vibe = await generate({ prompt, maxTokens: 256 });
    if (vibe) {
      await prisma.analysisJob.update({
        where: { id: jobId },
        data: { vibe: vibe.trim() },
      }).catch(() => null);
    }
  } catch {
    // fire-and-forget: vibe failure never surfaces to user
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Missing jobId", status: "error", data: null }, { status: 400 })
    );
  }

  const auth = extractUserFromRequest(request);
  if (!auth) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized", status: "error", data: null }, { status: 401 })
    );
  }
  const userId = auth.sub;

  const job = await prisma.analysisJob.findFirst({ where: { id: jobId, userId } }).catch(() => null);

  if (!job) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Job not found", status: "error", data: null }, { status: 404 })
    );
  }

  if (!job.inputText) {
    return applySecurityHeaders(
      NextResponse.json({ error: "No OCR text available for this job", status: "error", data: null }, { status: 422 })
    );
  }

  const encoder = new TextEncoder();
  const prompt = buildAnalysisPrompt(job.inputText, job.customPrompt);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("start", { jobId, status: "streaming" });

      let fullResponse = "";
      try {
        for await (const token of generateStream({ prompt })) {
          fullResponse += token;
          send("token", { token });
        }

        await prisma.analysisJob.update({
          where: { id: jobId },
          data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
        }).catch(() => null);

        // Fire-and-forget vibe generation after main analysis
        generateAndStoreVibe(jobId, job.inputText);

        send("done", { jobId, status: "completed", charCount: fullResponse.length });
      } catch (err) {
        send("error", { error: err.message || "Analysis stream failed" });

        await prisma.analysisJob.update({
          where: { id: jobId },
          data: { status: "FAILED", errorMessage: err.message },
        }).catch(() => null);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// POST variant: accepts text directly, streams response (for T9 smoke test)
export async function POST(request) {
  const auth = extractUserFromRequest(request);
  if (!auth) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return applySecurityHeaders(NextResponse.json({ error: "Invalid body" }, { status: 400 }));
  }

  const text = body?.text || body?.prompt || "";
  if (!text.trim()) {
    return applySecurityHeaders(NextResponse.json({ error: "text required" }, { status: 400 }));
  }
  if (text.length > 20000) {
    return applySecurityHeaders(NextResponse.json({ error: "text too large (max 20,000 chars)" }, { status: 413 }));
  }

  const customPrompt = typeof body?.customPrompt === "string" ? body.customPrompt.slice(0, 500) : "";
  const encoder = new TextEncoder();
  const prompt = buildAnalysisPrompt(text, customPrompt);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("start", { status: "streaming" });
      try {
        for await (const token of generateStream({ prompt })) {
          send("token", { token });
        }
        send("done", { status: "completed" });
      } catch (err) {
        send("error", { error: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
