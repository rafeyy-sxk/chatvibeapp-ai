/**
 * Adaptive Advice Generator
 * 
 * Generates personalized advice based on user profile and similar past analyses
 */

import prisma from '../prisma';
import { getUserProfile } from './userModeling';
import { cosineSimilarity } from './embeddings';
import { getRedisClient } from '../redis';

const redis = getRedisClient();
const ADVICE_CACHE_TTL = 60 * 60; // 1 hour

/**
 * Generate personalized advice for an analysis
 * @param {string} userId - User ID
 * @param {object} currentAnalysis - Current analysis data
 * @param {object} geminiSummary - Gemini analysis summary
 * @returns {Promise<string>} - Personalized advice text
 */
export async function generatePersonalizedAdvice(userId, currentAnalysis, geminiSummary) {
  // Check cache first
  const cacheKey = `advice:${userId}:${currentAnalysis.id}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Get user profile
  const userProfile = await getUserProfile(userId);
  
  // Get similar past analyses
  const similarAnalyses = await findSimilarAnalyses(userId, currentAnalysis, 3);
  
  // Build personalized prompt
  const personalizedPrompt = buildPersonalizedPrompt(
    userProfile,
    currentAnalysis,
    geminiSummary,
    similarAnalyses
  );
  
  // Generate advice using personalized context
  const advice = await generateAdviceWithContext(personalizedPrompt, geminiSummary);
  
  // Cache the advice
  await redis.setex(cacheKey, ADVICE_CACHE_TTL, advice);
  
  return advice;
}

/**
 * Find similar past analyses using embedding similarity
 */
async function findSimilarAnalyses(userId, currentAnalysis, limit = 3) {
  // Get current analysis embedding
  const currentEmbedding = await prisma.userAIEmbedding.findUnique({
    where: { analysisReportId: currentAnalysis.id },
  });
  
  if (!currentEmbedding || !currentEmbedding.embedding) {
    return [];
  }
  
  // Get all user's past embeddings
  const pastEmbeddings = await prisma.userAIEmbedding.findMany({
    where: {
      analysisReport: {
        userId,
        id: { not: currentAnalysis.id },
      },
    },
    include: {
      analysisReport: {
        include: {
          pastAnalysis: true,
        },
      },
    },
    take: 50, // Limit for performance
  });
  
  // Calculate similarities
  const similarities = pastEmbeddings
    .map(past => {
      if (!past.embedding || !Array.isArray(past.embedding)) {
        return null;
      }
      
      const similarity = cosineSimilarity(
        currentEmbedding.embedding,
        past.embedding
      );
      
      return {
        analysis: past.analysisReport,
        similarity,
        pastAnalysis: past.analysisReport.pastAnalysis,
      };
    })
    .filter(item => item !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return similarities;
}

/**
 * Build personalized prompt with user context
 */
function buildPersonalizedPrompt(userProfile, currentAnalysis, geminiSummary, similarAnalyses) {
  let prompt = `Based on the user's communication style and past patterns, provide personalized advice.\n\n`;
  
  // Add user profile context
  if (userProfile) {
    prompt += `User Profile:\n`;
    prompt += `- Communication Style: ${userProfile.communicationStyle?.directness > 0.6 ? 'Direct' : 'Indirect'}, `;
    prompt += `${userProfile.communicationStyle?.formality > 0.6 ? 'Formal' : 'Casual'}\n`;
    prompt += `- Conflict Style: ${userProfile.communicationStyle?.conflictStyle || 'Balanced'}\n`;
    prompt += `- Emotional Baseline: Friendly ${userProfile.emotionalBaseline?.averageFriendly || 0}, `;
    prompt += `Romantic ${userProfile.emotionalBaseline?.averageRomantic || 0}\n\n`;
  }
  
  // Add current analysis context
  prompt += `Current Analysis:\n`;
  prompt += `- Overall Vibe: ${geminiSummary.overall_vibe || 'Neutral'}\n`;
  prompt += `- Key Metrics: Flirty ${geminiSummary.metrics?.flirty || 0}, `;
  prompt += `Friendly ${geminiSummary.metrics?.friendly || 0}, `;
  prompt += `Angry ${geminiSummary.metrics?.angry || 0}\n`;
  prompt += `- Behavior Flags: ${(geminiSummary.behavior_flags || []).join(', ') || 'None'}\n\n`;
  
  // Add similar past analyses context
  if (similarAnalyses.length > 0) {
    prompt += `Similar Past Situations:\n`;
    for (const similar of similarAnalyses) {
      const pastSummary = similar.analysis.geminiSummary || {};
      prompt += `- ${pastSummary.overall_vibe || 'Similar situation'} `;
      prompt += `(similarity: ${Math.round(similar.similarity * 100)}%)\n`;
      
      // Add feedback if available
      if (similar.pastAnalysis?.userFeedback) {
        const feedback = similar.pastAnalysis.userFeedback;
        if (feedback.rating) {
          prompt += `  Previous feedback: ${feedback.rating}/5 stars\n`;
        }
      }
    }
    prompt += `\n`;
  }
  
  // Add personalized advice instructions
  prompt += `Provide advice that:\n`;
  if (userProfile?.communicationStyle?.directness > 0.6) {
    prompt += `- Is direct and straightforward (user prefers direct communication)\n`;
  } else {
    prompt += `- Is gentle and considerate (user prefers indirect communication)\n`;
  }
  
  if (userProfile?.communicationStyle?.conflictStyle === 'avoidant') {
    prompt += `- Helps navigate conflict carefully (user tends to avoid conflict)\n`;
  } else if (userProfile?.communicationStyle?.conflictStyle === 'direct') {
    prompt += `- Addresses issues head-on (user is comfortable with direct conflict)\n`;
  }
  
  prompt += `- References similar past situations when relevant\n`;
  prompt += `- Is actionable and specific\n`;
  
  return prompt;
}

/**
 * Generate advice using context (can call Gemini API or use template)
 */
async function generateAdviceWithContext(personalizedPrompt, geminiSummary) {
  // For now, use a template-based approach
  // In production, you could call Gemini API with the personalized prompt
  
  const metrics = geminiSummary.metrics || {};
  const behaviorFlags = geminiSummary.behavior_flags || [];
  const personalityTraits = geminiSummary.personality_traits || [];
  
  let advice = '';
  
  // Generate advice based on metrics
  if (metrics.flirty > 50) {
    advice += `The conversation shows strong flirtatious energy. `;
    if (metrics.romantic > 50) {
      advice += `This appears to be a romantic connection with mutual interest. `;
    } else {
      advice += `Consider whether this is playful banter or genuine romantic interest. `;
    }
  }
  
  if (metrics.passive_aggressive > 50) {
    advice += `There are signs of passive-aggressive communication. `;
    advice += `It might be helpful to address underlying concerns directly rather than through indirect messages. `;
  }
  
  if (metrics.angry > 50) {
    advice += `The conversation shows elevated anger levels. `;
    advice += `Consider taking a step back and addressing the root cause of frustration when emotions are calmer. `;
  }
  
  if (metrics.friendly > 60 && metrics.romantic < 30) {
    advice += `This appears to be a friendly, platonic connection. `;
    advice += `The communication style is warm and positive. `;
  }
  
  // Add behavior flag advice
  if (behaviorFlags.includes('mixed signals')) {
    advice += `There are mixed signals in this conversation. `;
    advice += `Clarifying intentions directly might help avoid misunderstandings. `;
  }
  
  if (behaviorFlags.includes('avoidance')) {
    advice += `There are signs of avoidance in the communication. `;
    advice += `Gently addressing important topics might help improve the relationship dynamic. `;
  }
  
  // Add personality trait advice
  if (personalityTraits.includes('defensive')) {
    advice += `The other person may be feeling defensive. `;
    advice += `Approaching conversations with empathy and validation can help reduce defensiveness. `;
  }
  
  // Default advice if nothing specific
  if (!advice) {
    advice = `The conversation shows a balanced dynamic. `;
    advice += `Continue communicating openly and honestly to maintain a healthy connection. `;
  }
  
  // Add personalized context from prompt
  advice += `\n\n[Personalized based on your communication style and past patterns]`;
  
  return advice.trim();
}

/**
 * Get cached personalized prompt for analysis
 */
export async function getCachedPersonalizedPrompt(userId, analysisId) {
  const cacheKey = `personalized_prompt:${userId}:${analysisId}`;
  return await redis.get(cacheKey);
}

/**
 * Cache personalized prompt
 */
export async function cachePersonalizedPrompt(userId, analysisId, prompt) {
  const cacheKey = `personalized_prompt:${userId}:${analysisId}`;
  await redis.setex(cacheKey, ADVICE_CACHE_TTL, prompt);
}

