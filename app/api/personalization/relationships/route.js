import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { applySecurityHeaders } from "@/lib/security/headers";
import { getUserRelationshipGraph } from "@/lib/personalization/relationshipGraph";
import { log } from "@/lib/logger";

// Ensure Node.js runtime for Prisma
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request) {
  try {
    const authPayload = verifyAccessToken(request);
    if (!authPayload) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const userId = authPayload.sub;

    // Get relationship graph
    const relationships = await getUserRelationshipGraph(userId);

    // Format for frontend
    const graph = relationships.map(rel => ({
      id: rel.id,
      personName: rel.personName,
      personIdentifier: rel.personIdentifier,
      relationshipType: rel.relationshipType,
      relationshipStrength: rel.relationshipStrength,
      interactionCount: rel.interactionCount,
      firstSeenAt: rel.firstSeenAt,
      lastSeenAt: rel.lastSeenAt,
      emotionalTrend: rel.emotionalTrend,
    }));

    return applySecurityHeaders(
      NextResponse.json({
        relationships: graph,
        totalRelationships: graph.length,
      })
    );
  } catch (error) {
    log.error("Error fetching relationships", error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    );
  }
}

