/**
 * GET /api/export?jobId=X&format=pdf|json|markdown|csv
 * Export analysis results in multiple formats.
 * PDF uses jspdf (already in deps).
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_FORMATS = ["json", "markdown", "csv", "pdf"];

function toMarkdown(job) {
  const r = job.result || {};
  return `# ChatVibe AI Analysis
**Job ID:** ${job.id}
**Created:** ${job.createdAt.toISOString()}
**Status:** ${job.status}

## Raw Analysis
${r.rawAnalysis || "No analysis available."}

## Extracted Text
${job.inputText || "—"}
`;
}

function toCSV(job) {
  const r = job.result || {};
  const headers = ["job_id", "status", "created_at", "analysis_summary"];
  const summary = (r.rawAnalysis || "").replace(/"/g, "'").replace(/\n/g, " ").slice(0, 500);
  const row = [job.id, job.status, job.createdAt.toISOString(), `"${summary}"`];
  return `${headers.join(",")}\n${row.join(",")}`;
}

async function toPDF(job) {
  // TODO: Full PDF layout with charts and formatting
  // Dynamic import to avoid SSR issues with jspdf
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const r = job.result || {};

  doc.setFontSize(18);
  doc.text("ChatVibe AI Analysis Report", 20, 20);

  doc.setFontSize(11);
  doc.text(`Job ID: ${job.id}`, 20, 35);
  doc.text(`Status: ${job.status}`, 20, 43);
  doc.text(`Date: ${job.createdAt.toISOString()}`, 20, 51);

  doc.setFontSize(13);
  doc.text("Analysis", 20, 65);
  doc.setFontSize(10);

  const analysis = r.rawAnalysis || "No analysis available.";
  const lines = doc.splitTextToSize(analysis, 170);
  doc.text(lines, 20, 75);

  return doc.output("arraybuffer");
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const format = (searchParams.get("format") || "json").toLowerCase();

  if (!jobId) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Missing jobId", status: "error", data: null }, { status: 400 })
    );
  }

  if (!SUPPORTED_FORMATS.includes(format)) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: `Unsupported format. Use: ${SUPPORTED_FORMATS.join(", ")}`, status: "error", data: null },
        { status: 400 }
      )
    );
  }

  let userId;
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) throw new Error("No token");
    userId = verifyAccessToken(token).sub;
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized", status: "error", data: null }, { status: 401 })
    );
  }

  const job = await prisma.analysisJob.findFirst({
    where: { id: jobId, userId },
  }).catch(() => null);

  if (!job) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Job not found", status: "error", data: null }, { status: 404 })
    );
  }

  const filename = `chatvibe-analysis-${jobId.slice(0, 8)}`;

  if (format === "json") {
    return new Response(
      JSON.stringify({ data: job.result, status: "ok", error: null }, null, 2),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      }
    );
  }

  if (format === "markdown") {
    return new Response(toMarkdown(job), {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }

  if (format === "csv") {
    return new Response(toCSV(job), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    try {
      const pdfBuffer = await toPDF(job);
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    } catch (err) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "PDF generation failed: " + err.message, status: "error", data: null },
          { status: 500 }
        )
      );
    }
  }
}
