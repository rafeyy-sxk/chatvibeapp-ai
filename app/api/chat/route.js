/**
 * POST /api/chat
 * Continue a Groq conversation about a specific analysis result.
 * Stores conversation history in Redis (TTL 24h).
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractUserFromRequest } from "@/lib/auth/tokens";
import { generate } from "@/lib/ai";
import redis from "@/lib/redis";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const maxDuration = 30;

const CHAT_TTL = 60 * 60 * 24; // 24 hours
const MAX_HISTORY = 20;

function chatKey(userId, jobId) {
  return `chat:${userId}:${jobId}`;
}

function buildChatPrompt(analysisContext, history, userMessage) {
  const historyText = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  return `You are an AI assistant helping analyze conversation data. Here is the analysis context:

${analysisContext}

Previous conversation:
${historyText || "None"}

User: ${userMessage}

Respond helpfully and specifically about the analysis above.`;
}

export async function POST(request) {
  const authPayload = extractUserFromRequest(request);
  if (!authPayload) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized", status: "error", data: null }, { status: 401 })
    );
  }
  const userId = authPayload.sub;

  let body;
  try {
    body = await request.json();
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "Invalid JSON", status: "error", data: null }, { status: 400 })
    );
  }

  const { jobId, message } = body;

  if (!jobId || !message || typeof message !== "string" || !message.trim() || message.length > 2000) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "jobId and message are required", status: "error", data: null },
        { status: 400 }
      )
    );
  }

  const key = chatKey(userId, jobId);

  // Fetch job + conversation history in parallel
  const [job, cachedHistory] = await Promise.all([
    prisma.analysisJob.findFirst({
      where: { id: jobId, userId, status: "COMPLETED" },
      select: { inputText: true },
    }).catch(() => null),
    redis.get(key).catch(() => null),
  ]);

  if (!job) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Completed job not found", status: "error", data: null },
        { status: 404 }
      )
    );
  }

  let history = [];
  try {
    if (cachedHistory) history = JSON.parse(cachedHistory);
  } catch {
    // malformed cache — start fresh
  }

  const analysisContext = (job.inputText || "No context available").slice(0, 3000);
  const prompt = buildChatPrompt(analysisContext, history.slice(-MAX_HISTORY), message.trim());

  let reply;
  try {
    reply = await generate({ prompt });
  } catch (err) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "AI unavailable: " + err.message, status: "error", data: null },
        { status: 503 }
      )
    );
  }

  history.push({ role: "user", content: message.trim() });
  history.push({ role: "assistant", content: reply });

  // Persist updated conversation (trimmed to last MAX_HISTORY messages)
  try {
    await redis.setex(key, CHAT_TTL, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // Non-fatal: Redis unavailable
  }

  return applySecurityHeaders(
    NextResponse.json({
      data: { reply, jobId, messageCount: history.length },
      status: "ok",
      error: null,
    })
  );
}

/** DELETE /api/chat?jobId=X — clear conversation history */
export async function DELETE(request) {
  const authPayload = extractUserFromRequest(request);
  if (!authPayload) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized", status: "error", data: null }, { status: 401 })
    );
  }
  const userId = authPayload.sub;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Missing jobId", status: "error", data: null }, { status: 400 })
    );
  }

  await redis.del(chatKey(userId, jobId)).catch(() => null);
  return applySecurityHeaders(
    NextResponse.json({ data: { cleared: true }, status: "ok", error: null })
  );
}
