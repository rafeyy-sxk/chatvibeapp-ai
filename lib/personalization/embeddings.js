/**
 * Embedding Service for AI Personalization
 * 
 * Generates embeddings using Gemini Embeddings API (text-embedding-004)
 * Falls back to OpenAI if Gemini is unavailable
 */

import { env } from '../env';
import { captureException } from '../logger';
import { getRedisClient } from '../redis';

const redis = getRedisClient();

// Simple logger wrapper
const log = {
  debug: (msg, ctx) => console.log(`[embedding:debug] ${msg}`, ctx || ''),
  warn: (msg, ctx) => console.warn(`[embedding:warn] ${msg}`, ctx || ''),
  error: (msg, error, ctx) => {
    console.error(`[embedding:error] ${msg}`, error, ctx || '');
    captureException(error, { message: msg, ...ctx });
  },
};

const EMBEDDING_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const EMBEDDING_DIMENSIONS = 768; // Gemini text-embedding-004 dimensions

/**
 * Generate embedding using Gemini Embeddings API
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 768-dimensional embedding vector
 */
export async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  // Check cache first
  const cacheKey = `embedding:${hashText(text)}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    log.debug('Embedding cache hit', { textLength: text.length });
    return JSON.parse(cached);
  }

  try {
    // Try Gemini Embeddings API first
    const embedding = await generateGeminiEmbedding(text);
    
    // Cache the result
    await redis.setex(cacheKey, EMBEDDING_CACHE_TTL, JSON.stringify(embedding));
    
    return embedding;
  } catch (error) {
    log.warn('Gemini embedding failed, trying fallback', { error: error.message });
    
    // Fallback to OpenAI (if configured)
    try {
      const embedding = await generateOpenAIEmbedding(text);
      await redis.setex(cacheKey, EMBEDDING_CACHE_TTL, JSON.stringify(embedding));
      return embedding;
    } catch (fallbackError) {
      log.error('All embedding services failed', { 
        geminiError: error.message,
        openaiError: fallbackError.message 
      });
      throw new Error('Embedding generation failed: ' + fallbackError.message);
    }
  }
}

/**
 * Generate embedding using Gemini Embeddings API
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 768-dimensional embedding vector
 */
async function generateGeminiEmbedding(text) {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Truncate text if too long (Gemini has limits)
  const maxLength = 20000; // Conservative limit
  const truncatedText = text.length > maxLength 
    ? text.substring(0, maxLength) 
    : text;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [
            {
              text: truncatedText,
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const embedding = data.embedding?.values;

  if (!embedding || !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Invalid embedding format: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding?.length || 0}`);
  }

  return embedding;
}

/**
 * Generate embedding using OpenAI API (fallback)
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector (will be converted to 768)
 */
async function generateOpenAIEmbedding(text) {
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured for fallback');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // 1536 dimensions
      input: text,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Invalid OpenAI embedding format');
  }

  // Convert 1536-dim to 768-dim by averaging pairs
  // This is a simple reduction - in production, you might use PCA or other methods
  const reducedEmbedding = [];
  for (let i = 0; i < embedding.length; i += 2) {
    const avg = (embedding[i] + (embedding[i + 1] || 0)) / 2;
    reducedEmbedding.push(avg);
  }

  // Ensure we have exactly 768 dimensions
  while (reducedEmbedding.length < EMBEDDING_DIMENSIONS) {
    reducedEmbedding.push(0);
  }
  return reducedEmbedding.slice(0, EMBEDDING_DIMENSIONS);
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} embedding1 - First embedding vector
 * @param {number[]} embedding2 - Second embedding vector
 * @returns {number} - Similarity score between -1 and 1
 */
export function cosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Batch generate embeddings
 * @param {string[]} texts - Array of texts to embed
 * @param {number} batchSize - Number of texts to process in parallel (default: 10)
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text).catch(error => {
        log.error('Failed to generate embedding for text', { error: error.message, textLength: text.length });
        return null; // Return null for failed embeddings
      }))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Hash text for cache key
 * @param {string} text - Text to hash
 * @returns {string} - Hash string
 */
function hashText(text) {
  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

