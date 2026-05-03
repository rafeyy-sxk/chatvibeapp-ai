/**
 * Relationship Graph Service
 * 
 * Extracts and tracks people the user chats about
 */

import prisma from '../prisma';
import { extractChatFeatures } from './featureExtractor';

/**
 * Extract relationships from analysis and update graph
 * @param {string} userId - User ID
 * @param {string} analysisReportId - Analysis report ID
 * @param {string} chatText - Chat text to analyze
 * @param {object} geminiSummary - Gemini analysis summary
 */
export async function extractAndUpdateRelationships(userId, analysisReportId, chatText, geminiSummary) {
  // Extract person names/identifiers from chat
  const persons = extractPersons(chatText);
  
  // Extract relationship features
  const features = extractChatFeatures(chatText, geminiSummary);
  
  // Update relationship graph for each person
  for (const person of persons) {
    await updateRelationshipNode(userId, person, features, geminiSummary);
  }
}

/**
 * Extract person names/identifiers from chat text
 * Simple extraction - can be enhanced with NER models
 */
function extractPersons(chatText) {
  const persons = new Set();
  
  // Common patterns for names (capitalized words, common name patterns)
  // This is a simplified version - in production, use NER or more sophisticated extraction
  const lines = chatText.split('\n');
  
  for (const line of lines) {
    // Look for patterns like "Name:" or "Name -" or just capitalized words at start of line
    const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[:-\s]/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name.length > 2 && name.length < 30) {
        persons.add(name);
      }
    }
  }
  
  // If no names found, create an anonymized identifier
  if (persons.size === 0) {
    // Create hash-based identifier for privacy
    const hash = simpleHash(chatText.substring(0, 100));
    persons.add(`person_${hash}`);
  }
  
  return Array.from(persons);
}

/**
 * Simple hash function for anonymization
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Update relationship node in graph
 */
async function updateRelationshipNode(userId, personName, features, geminiSummary) {
  // Create anonymized identifier
  const personIdentifier = personName.startsWith('person_') 
    ? personName 
    : `person_${simpleHash(personName)}`;
  
  // Classify relationship type
  const relationshipType = classifyRelationshipType(features, geminiSummary);
  
  // Calculate relationship strength
  const relationshipStrength = calculateRelationshipStrength(features, geminiSummary);
  
  // Get or create relationship node
  const existing = await prisma.relationshipGraph.findUnique({
    where: {
      userId_personIdentifier: {
        userId,
        personIdentifier,
      },
    },
  });
  
  // Get emotional trend
  const emotionalTrend = existing?.emotionalTrend || [];
  emotionalTrend.push({
    date: new Date().toISOString(),
    metrics: {
      flirty: geminiSummary?.metrics?.flirty || 0,
      angry: geminiSummary?.metrics?.angry || 0,
      friendly: geminiSummary?.metrics?.friendly || 0,
      romantic: geminiSummary?.metrics?.romantic || 0,
      dryEnergy: geminiSummary?.metrics?.dry_energy || 0,
      confused: geminiSummary?.metrics?.confused || 0,
    },
  });
  
  // Keep only last 30 entries
  if (emotionalTrend.length > 30) {
    emotionalTrend.shift();
  }
  
  if (existing) {
    // Update existing relationship
    await prisma.relationshipGraph.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        interactionCount: existing.interactionCount + 1,
        relationshipType: relationshipType,
        relationshipStrength: relationshipStrength,
        emotionalTrend: emotionalTrend,
        metadata: {
          ...(existing.metadata || {}),
          lastFeatures: features,
        },
      },
    });
  } else {
    // Create new relationship
    await prisma.relationshipGraph.create({
      data: {
        userId,
        personName: personName, // Store original name (can be anonymized in production)
        personIdentifier: personIdentifier,
        relationshipType: relationshipType,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        interactionCount: 1,
        relationshipStrength: relationshipStrength,
        emotionalTrend: emotionalTrend,
        metadata: {
          lastFeatures: features,
        },
      },
    });
  }
}

/**
 * Classify relationship type based on features
 */
function classifyRelationshipType(features, geminiSummary) {
  const metrics = geminiSummary?.metrics || {};
  const romantic = metrics.romantic || 0;
  const friendly = metrics.friendly || 0;
  const flirty = metrics.flirty || 0;
  
  if (romantic > 50 || flirty > 50) {
    return 'ROMANTIC';
  } else if (friendly > 60) {
    return 'FRIEND';
  } else if (features.social.engagementLevel < 0.3) {
    return 'ACQUAINTANCE';
  } else {
    // Could add more sophisticated classification
    return 'OTHER';
  }
}

/**
 * Calculate relationship strength (0-1)
 */
function calculateRelationshipStrength(features, geminiSummary) {
  const engagement = features.social.engagementLevel;
  const sentiment = features.emotional.sentimentScore;
  const messageCount = features.social.messageCount;
  
  // Higher engagement + positive sentiment + more messages = stronger relationship
  const strength = (engagement * 0.4 + sentiment * 0.3 + Math.min(messageCount / 50, 1) * 0.3);
  
  return Math.round(Math.min(strength, 1) * 100) / 100;
}

/**
 * Get user's relationship graph
 */
export async function getUserRelationshipGraph(userId) {
  return await prisma.relationshipGraph.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
  });
}

/**
 * Get relationship details
 */
export async function getRelationshipDetails(userId, personIdentifier) {
  return await prisma.relationshipGraph.findUnique({
    where: {
      userId_personIdentifier: {
        userId,
        personIdentifier,
      },
    },
  });
}

