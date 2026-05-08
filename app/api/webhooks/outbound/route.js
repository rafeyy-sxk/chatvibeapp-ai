/**
 * POST /api/webhooks/outbound — register an outbound webhook endpoint
 * GET  /api/webhooks/outbound — list user's registered webhooks
 * DELETE /api/webhooks/outbound?id=X — remove a webhook
 *
 * When an analysis job completes, the worker calls deliverWebhook() from lib/webhooks.js
 *
 * TODO: Add Webhook model to prisma/schema.prisma:
 *   model Webhook {
 *     id        String   @id @default(cuid())
 *     userId    String
 *     url       String
 *     events    String[] @default(["job.completed"])
 *     secret    String
 *     active    Boolean  @default(true)
 *     createdAt DateTime @default(now())
 *     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
 *   }
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

const MAX_WEBHOOKS_PER_USER = 5;

function validateUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.hostname === "localhost";
  } catch {
    return false;
  }
}

export async function POST(request) {
  let userId;
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) throw new Error();
    userId = verifyAccessToken(token).sub;
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized", status: "error", data: null }, { status: 401 })
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "Invalid JSON", status: "error", data: null }, { status: 400 })
    );
  }

  const { url, events = ["job.completed"] } = body;

  if (!url || !validateUrl(url)) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "url must be a valid HTTPS URL", status: "error", data: null },
        { status: 400 }
      )
    );
  }

  // TODO: Uncomment once Webhook model is added to schema
  // const count = await prisma.webhook.count({ where: { userId } });
  // if (count >= MAX_WEBHOOKS_PER_USER) {
  //   return applySecurityHeaders(
  //     NextResponse.json({ error: `Max ${MAX_WEBHOOKS_PER_USER} webhooks per account`, status: "error", data: null }, { status: 400 })
  //   );
  // }

  const secret = randomBytes(20).toString("hex");

  // TODO: Persist to database once Webhook model exists
  // const webhook = await prisma.webhook.create({
  //   data: { userId, url, events, secret }
  // });

  return applySecurityHeaders(
    NextResponse.json({
      data: {
        // id: webhook.id,
        id: `wh_${randomBytes(8).toString("hex")}`,
        url,
        events,
        secret,
        message: "Webhook registered. Use the secret to verify delivery signatures (HMAC-SHA256).",
      },
      status: "ok",
      error: null,
    },
    { status: 201 })
  );
}

export async function GET(request) {
  let userId;
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) throw new Error();
    userId = verifyAccessToken(token).sub;
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized", status: "error", data: null }, { status: 401 })
    );
  }

  // TODO: Replace with prisma.webhook.findMany({ where: { userId } }) once schema updated
  return applySecurityHeaders(
    NextResponse.json({
      data: { webhooks: [], message: "Webhook persistence requires Webhook model migration." },
      status: "ok",
      error: null,
    })
  );
}
