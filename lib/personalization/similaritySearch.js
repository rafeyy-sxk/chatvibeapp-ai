/**
 * Similarity Search Service
 * 
 * Fast similarity search using embeddings (pgvector or Redis)
 * For now, uses in-memory search with PostgreSQL JSON storage
 * Can be upgraded to pgvector for better performance
 */

import prisma from '../prisma';
import { cosineSimilarity } from './embeddings';
import { getRedisClient } from '../redis';

const redis = getRedisClient();
const SEARCH_CACHE_TTL = 15 * 60; // 15 minutes

/**
 * Find similar analyses using embedding similarity
 * @param {string} userId - User ID
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {number} limit - Maximum number of results
 * @param {number} minSimilarity - Minimum similarity threshold (0-1)
 * @returns {Promise<Array>} - Array of similar analyses with similarity scores
 */
export async function findSimilarAnalyses(userId, queryEmbedding, limit = 10, minSimilarity = 0.7) {
  // Check cache
  const cacheKey = `similarity:${userId}:${hashEmbedding(queryEmbedding)}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Get all user's embeddings
  const embeddings = await prisma.userAIEmbedding.findMany({
    where: {
      analysisReport: {
        userId,
      },
    },
    include: {
      analysisReport: {
        include: {
          pastAnalysis: true,
        },
      },
    },
  });

  // Calculate similarities
  const similarities = embeddings
    .map(item => {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        return null;
      }

      const similarity = cosineSimilarity(queryEmbedding, item.embedding);
      
      return {
        analysisReportId: item.analysisReportId,
        analysisReport: item.analysisReport,
        similarity,
        textChunk: item.textChunk.substring(0, 200), // Preview
      };
    })
    .filter(item => item !== null && item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  // Cache results
  await redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(similarities));

  return similarities;
}

/**
 * Find similar analyses by analysis report ID
 * @param {string} userId - User ID
 * @param {string} analysisReportId - Analysis report ID to find similar to
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of similar analyses
 */
export async function findSimilarToAnalysis(userId, analysisReportId, limit = 10) {
  // Get the query embedding
  const queryEmbedding = await prisma.userAIEmbedding.findUnique({
    where: { analysisReportId },
  });

  if (!queryEmbedding || !queryEmbedding.embedding) {
    return [];
  }

  return await findSimilarAnalyses(userId, queryEmbedding.embedding, limit);
}

/**
 * Find analyses similar to text
 * @param {string} userId - User ID
 * @param {string} text - Text to find similar analyses for
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of similar analyses
 */
export async function findSimilarToText(userId, text, limit = 10) {
  // Generate embedding for text
  const { generateEmbedding } = await import('./embeddings');
  const queryEmbedding = await generateEmbedding(text);

  return await findSimilarAnalyses(userId, queryEmbedding, limit);
}

/**
 * Hash embedding for cache key
 */
function hashEmbedding(embedding) {
  // Simple hash of first few dimensions
  const hash = embedding.slice(0, 10).reduce((sum, val) => sum + Math.round(val * 1000), 0);
  return Math.abs(hash).toString(36).substring(0, 12);
}

/**
 * Batch similarity search (for multiple queries)
 */
export async function batchSimilaritySearch(userId, queryEmbeddings, limit = 10) {
  const results = await Promise.all(
    queryEmbeddings.map(embedding => findSimilarAnalyses(userId, embedding, limit))
  );
  
  return results;
}

