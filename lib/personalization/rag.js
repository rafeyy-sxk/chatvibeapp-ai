/**
 * Basic RAG (Retrieval-Augmented Generation) for ChatVibe AI
 * Stores analysis results as embeddings for similar conversation retrieval
 */

import { createHash } from "crypto";
import prisma from "../prisma";
import { log } from "../logger";

// Simple text-to-vector conversion (placeholder for actual embeddings)
function textToVector(text) {
  const hash = createHash("sha256").update(text).digest("hex");
  const vector = [];
  for (let i = 0; i < 384; i += 8) { // 384-dimensional vector
    vector.push(parseInt(hash.substr(i, 8), 16) / 0xFFFFFFFF);
  }
  return vector;
}

// Cosine similarity calculation
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Store analysis result for RAG
export async function storeAnalysisForRAG(userId, analysisResult, originalText) {
  try {
    const vector = textToVector(originalText);
    const embedding = JSON.stringify(vector);
    
    await prisma.userAIEmbedding.create({
      data: {
        userId,
        analysisId: analysisResult.id,
        embedding,
        content: originalText.substring(0, 1000), // Store truncated content
        metadata: {
          summary: analysisResult.geminiSummary?.summary,
          overallVibe: analysisResult.geminiSummary?.overall_vibe,
          metrics: analysisResult.geminiSummary?.metrics,
        },
      },
    });
    
    log.info("Analysis stored for RAG", { userId, analysisId: analysisResult.id });
  } catch (error) {
    log.error("Failed to store analysis for RAG", { error: error.message, userId });
  }
}

// Retrieve similar analyses for context
export async function retrieveSimilarAnalyses(userId, currentText, limit = 3) {
  try {
    const currentVector = textToVector(currentText);
    
    // Get user's embeddings
    const embeddings = await prisma.userAIEmbedding.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit for performance
    });
    
    if (embeddings.length === 0) return [];
    
    // Calculate similarities
    const similarities = embeddings.map(emb => ({
      ...emb,
      similarity: cosineSimilarity(currentVector, JSON.parse(emb.embedding)),
    }));
    
    // Sort by similarity and return top matches
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, limit).map(sim => ({
      analysisId: sim.analysisId,
      content: sim.content,
      metadata: sim.metadata,
      similarity: sim.similarity,
    }));
  } catch (error) {
    log.error("Failed to retrieve similar analyses", { error: error.message, userId });
    return [];
  }
}

// Generate RAG-augmented prompt
export async function generateRAGPrompt(userId, currentText, basePrompt) {
  const similarAnalyses = await retrieveSimilarAnalyses(userId, currentText);
  
  if (similarAnalyses.length === 0) {
    return basePrompt;
  }
  
  const context = similarAnalyses
    .filter(sim => sim.similarity > 0.7) // Only highly similar
    .map(sim => `Previous similar analysis: ${sim.metadata?.summary || 'N/A'}`)
    .join('\n');
  
  if (!context) return basePrompt;
  
  return `${basePrompt}

Context from similar previous analyses:
${context}

Use this context to provide more consistent and personalized insights.`;
}