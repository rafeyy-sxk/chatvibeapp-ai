/**
 * SSE Stream Endpoint for Job Status
 * 
 * Streams real-time job progress updates via Server-Sent Events
 * Optimized for Vercel Edge Functions
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import prisma from "@/lib/prisma";
import { log } from "@/lib/logger";

export const runtime = 'nodejs'; // Use Node.js runtime for Prisma
export const maxDuration = 60; // 60 seconds max for SSE connection

export async function GET(request, { params }) {
  const { id } = params;

  // Verify authentication (support both header and query param for EventSource)
  const { searchParams } = new URL(request.url);
  let token = searchParams.get("token");
  
  if (!token) {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader) {
      const [scheme, headerToken] = authHeader.split(" ");
      if (scheme === "Bearer") {
        token = headerToken;
      }
    }
  }

  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let authPayload;
  try {
    authPayload = verifyAccessToken(token);
  } catch (error) {
    return new NextResponse("Invalid or expired token", { status: 401 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', jobId: id })}\n\n`));

      let pollCount = 0;
      const maxPolls = 300; // 5 minutes max (300 * 1 second)

      // Poll for job updates
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        // Timeout after max polls
        if (pollCount > maxPolls) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'timeout' })}\n\n`));
          clearInterval(pollInterval);
          controller.close();
          return;
        }

        try {
          // Get job from database
          const job = await prisma.analysisJob.findUnique({
            where: { id },
            select: {
              id: true,
              userId: true,
              status: true,
              progress: true,
              errorMessage: true,
              createdAt: true,
              completedAt: true,
            },
          });

          if (!job) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Job not found' })}\n\n`));
            clearInterval(pollInterval);
            controller.close();
            return;
          }

          // Check if user owns this job
          if (job.userId !== authPayload.sub) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized' })}\n\n`));
            clearInterval(pollInterval);
            controller.close();
            return;
          }

          // Send update
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'update',
            job: {
              id: job.id,
              status: job.status,
              progress: job.progress,
              errorMessage: job.errorMessage,
              completedAt: job.completedAt,
            },
          })}\n\n`));

          // Close stream if job is complete or failed
          if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
            clearInterval(pollInterval);
            
            // If completed, send report ID
            if (job.status === 'COMPLETED') {
              const report = await prisma.analysisReport.findUnique({
                where: { jobId: id },
                select: { id: true },
              });
              
              if (report) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'completed',
                  reportId: report.id,
                })}\n\n`));
              }
            }
            
            controller.close();
          }
        } catch (error) {
          log.error('SSE stream error', error, { jobId: id });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error.message,
          })}\n\n`));
          clearInterval(pollInterval);
          controller.close();
        }
      }, 1000); // Poll every second

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}
