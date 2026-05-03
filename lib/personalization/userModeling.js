/**
 * User Modeling Service
 * 
 * Builds long-term user profiles from past analyses:
 * - Personality profile
 * - Communication style
 * - Consistency metrics
 * - Emotional trendline
 */

import prisma from '../prisma';
import { generateEmbedding } from './embeddings';
import { extractChatFeatures } from './featureExtractor';

/**
 * Build or update user AI profile from past analyses
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Updated user profile
 */
export async function buildUserProfile(userId) {
  // Get all past analyses for this user
  const analyses = await prisma.analysisReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      pastAnalysis: true,
    },
  });

  if (analyses.length === 0) {
    // Create initial profile with defaults
    return await createInitialProfile(userId);
  }

  // Extract features from all analyses
  const allFeatures = analyses.map(analysis => {
    const geminiSummary = analysis.geminiSummary || {};
    return extractChatFeatures(analysis.ocrTranscript, geminiSummary);
  });

  // Calculate personality traits (Big Five + MBTI-like)
  const personalityTraits = calculatePersonalityTraits(allFeatures, analyses);

  // Calculate communication style
  const communicationStyle = calculateCommunicationStyle(allFeatures, analyses);

  // Calculate consistency score
  const consistencyScore = calculateConsistencyScore(allFeatures);

  // Calculate emotional baseline
  const emotionalBaseline = calculateEmotionalBaseline(allFeatures, analyses);

  // Generate profile vector (embedding of aggregated profile text)
  const profileText = buildProfileText(personalityTraits, communicationStyle, emotionalBaseline);
  const profileVector = await generateEmbedding(profileText);

  // Update or create profile
  const profile = await prisma.userAIProfile.upsert({
    where: { userId },
    create: {
      userId,
      personalityTraits: personalityTraits,
      communicationStyle: communicationStyle,
      consistencyScore: consistencyScore,
      emotionalBaseline: emotionalBaseline,
      profileVector: profileVector,
      analysisCount: analyses.length,
      lastUpdated: new Date(),
    },
    update: {
      personalityTraits: personalityTraits,
      communicationStyle: communicationStyle,
      consistencyScore: consistencyScore,
      emotionalBaseline: emotionalBaseline,
      profileVector: profileVector,
      analysisCount: analyses.length,
      lastUpdated: new Date(),
    },
  });

  return profile;
}

/**
 * Create initial profile with default values
 */
async function createInitialProfile(userId) {
  const defaultTraits = {
    openness: 0.5,
    conscientiousness: 0.5,
    extraversion: 0.5,
    agreeableness: 0.5,
    neuroticism: 0.5,
    mbtiType: 'UNKNOWN',
  };

  const defaultStyle = {
    directness: 0.5,
    formality: 0.5,
    emotionalOpenness: 0.5,
    humorStyle: 'neutral',
    conflictStyle: 'balanced',
  };

  const defaultBaseline = {
    averageFlirty: 0,
    averageAngry: 0,
    averageFriendly: 0,
    averageRomantic: 0,
    averageDryEnergy: 0,
    averageConfused: 0,
  };

  const profileText = buildProfileText(defaultTraits, defaultStyle, defaultBaseline);
  const profileVector = await generateEmbedding(profileText);

  return await prisma.userAIProfile.create({
    data: {
      userId,
      personalityTraits: defaultTraits,
      communicationStyle: defaultStyle,
      consistencyScore: 0.5,
      emotionalBaseline: defaultBaseline,
      profileVector: profileVector,
      analysisCount: 0,
      lastUpdated: new Date(),
    },
  });
}

/**
 * Calculate personality traits from features
 */
function calculatePersonalityTraits(allFeatures, analyses) {
  if (allFeatures.length === 0) {
    return {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5,
      mbtiType: 'UNKNOWN',
    };
  }

  // Aggregate linguistic and emotional features
  const avgWordCount = allFeatures.reduce((sum, f) => sum + f.linguistic.wordCount, 0) / allFeatures.length;
  const avgSentiment = allFeatures.reduce((sum, f) => sum + f.emotional.sentimentScore, 0) / allFeatures.length;
  const avgEmotionalIntensity = allFeatures.reduce((sum, f) => sum + f.emotional.emotionalIntensity, 0) / allFeatures.length;
  const avgEngagement = allFeatures.reduce((sum, f) => sum + f.social.engagementLevel, 0) / allFeatures.length;

  // Simple heuristics for Big Five (can be enhanced with ML models)
  const openness = Math.min(avgWordCount / 500, 1); // More words = more open
  const conscientiousness = Math.min(avgEngagement, 1); // Higher engagement = more conscientious
  const extraversion = Math.min(avgEmotionalIntensity * 1.5, 1); // Higher intensity = more extraverted
  const agreeableness = Math.min(avgSentiment * 1.2, 1); // More positive = more agreeable
  const neuroticism = Math.min((1 - avgSentiment) * 1.2, 1); // More negative = more neurotic

  // Simple MBTI-like classification (very simplified)
  const mbtiType = classifyMBTI(openness, conscientiousness, extraversion, agreeableness);

  return {
    openness: Math.round(openness * 100) / 100,
    conscientiousness: Math.round(conscientiousness * 100) / 100,
    extraversion: Math.round(extraversion * 100) / 100,
    agreeableness: Math.round(agreeableness * 100) / 100,
    neuroticism: Math.round(neuroticism * 100) / 100,
    mbtiType,
  };
}

/**
 * Simple MBTI-like classification
 */
function classifyMBTI(openness, conscientiousness, extraversion, agreeableness) {
  // Very simplified MBTI classification
  const e = extraversion > 0.5 ? 'E' : 'I';
  const s = openness > 0.5 ? 'N' : 'S';
  const t = agreeableness < 0.5 ? 'T' : 'F';
  const j = conscientiousness > 0.5 ? 'J' : 'P';
  return `${e}${s}${t}${j}`;
}

/**
 * Calculate communication style
 */
function calculateCommunicationStyle(allFeatures, analyses) {
  if (allFeatures.length === 0) {
    return {
      directness: 0.5,
      formality: 0.5,
      emotionalOpenness: 0.5,
      humorStyle: 'neutral',
      conflictStyle: 'balanced',
    };
  }

  const avgMessageLength = allFeatures.reduce((sum, f) => sum + f.linguistic.avgMessageLength, 0) / allFeatures.length;
  const avgPunctuation = allFeatures.reduce((sum, f) => sum + f.linguistic.punctuationDensity, 0) / allFeatures.length;
  const avgEmoji = allFeatures.reduce((sum, f) => sum + f.linguistic.emojiDensity, 0) / allFeatures.length;
  const avgQuestionCount = allFeatures.reduce((sum, f) => sum + f.linguistic.questionCount, 0) / allFeatures.length;

  // Directness: longer messages + fewer questions = more direct
  const directness = Math.min((avgMessageLength / 100) * 0.7 + (1 - avgQuestionCount / 10) * 0.3, 1);

  // Formality: more punctuation + fewer emojis = more formal
  const formality = Math.min(avgPunctuation * 1.5 + (1 - avgEmoji) * 0.5, 1);

  // Emotional openness: more emojis + higher emotional intensity = more open
  const avgEmotionalIntensity = allFeatures.reduce((sum, f) => sum + f.emotional.emotionalIntensity, 0) / allFeatures.length;
  const emotionalOpenness = Math.min(avgEmoji * 0.6 + avgEmotionalIntensity * 0.4, 1);

  // Humor style: based on emoji usage and sentiment
  const avgSentiment = allFeatures.reduce((sum, f) => sum + f.emotional.sentimentScore, 0) / allFeatures.length;
  const humorStyle = avgEmoji > 0.3 && avgSentiment > 0.6 ? 'playful' : 
                     avgEmoji < 0.1 ? 'dry' : 'neutral';

  // Conflict style: based on passive-aggressive metrics
  const avgPassiveAggressive = allFeatures.reduce((sum, f) => 
    sum + (f.emotional.passiveAggressive || 0), 0) / allFeatures.length;
  const conflictStyle = avgPassiveAggressive > 50 ? 'avoidant' : 
                        avgPassiveAggressive < 20 ? 'direct' : 'balanced';

  return {
    directness: Math.round(directness * 100) / 100,
    formality: Math.round(formality * 100) / 100,
    emotionalOpenness: Math.round(emotionalOpenness * 100) / 100,
    humorStyle,
    conflictStyle,
  };
}

/**
 * Calculate consistency score (0-1)
 * Higher score = more consistent patterns across analyses
 */
function calculateConsistencyScore(allFeatures) {
  if (allFeatures.length < 2) {
    return 0.5; // Not enough data
  }

  // Calculate variance in key metrics
  const sentimentScores = allFeatures.map(f => f.emotional.sentimentScore);
  const engagementScores = allFeatures.map(f => f.social.engagementLevel);
  const messageLengths = allFeatures.map(f => f.linguistic.avgMessageLength);

  const variance = (arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
  };

  const sentimentVar = variance(sentimentScores);
  const engagementVar = variance(engagementScores);
  const lengthVar = variance(messageLengths) / 10000; // Normalize

  // Lower variance = higher consistency
  const consistency = 1 - Math.min((sentimentVar + engagementVar + lengthVar) / 3, 1);
  
  return Math.round(consistency * 100) / 100;
}

/**
 * Calculate emotional baseline
 */
function calculateEmotionalBaseline(allFeatures, analyses) {
  if (allFeatures.length === 0) {
    return {
      averageFlirty: 0,
      averageAngry: 0,
      averageFriendly: 0,
      averageRomantic: 0,
      averageDryEnergy: 0,
      averageConfused: 0,
    };
  }

  const metrics = ['flirty', 'angry', 'friendly', 'romantic', 'dryEnergy', 'confused'];
  const baseline = {};

  for (const metric of metrics) {
    const values = allFeatures
      .map(f => f.emotional[metric] || 0)
      .filter(v => v !== null && v !== undefined);
    
    if (values.length > 0) {
      baseline[`average${metric.charAt(0).toUpperCase() + metric.slice(1)}`] = 
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
    } else {
      baseline[`average${metric.charAt(0).toUpperCase() + metric.slice(1)}`] = 0;
    }
  }

  return baseline;
}

/**
 * Build profile text for embedding
 */
function buildProfileText(personalityTraits, communicationStyle, emotionalBaseline) {
  return `
Personality: Openness ${personalityTraits.openness}, Conscientiousness ${personalityTraits.conscientiousness}, 
Extraversion ${personalityTraits.extraversion}, Agreeableness ${personalityTraits.agreeableness}, 
Neuroticism ${personalityTraits.neuroticism}. MBTI: ${personalityTraits.mbtiType}.

Communication Style: Directness ${communicationStyle.directness}, Formality ${communicationStyle.formality}, 
Emotional Openness ${communicationStyle.emotionalOpenness}, Humor: ${communicationStyle.humorStyle}, 
Conflict Style: ${communicationStyle.conflictStyle}.

Emotional Baseline: Flirty ${emotionalBaseline.averageFlirty}, Angry ${emotionalBaseline.averageAngry}, 
Friendly ${emotionalBaseline.averageFriendly}, Romantic ${emotionalBaseline.averageRomantic}, 
Dry Energy ${emotionalBaseline.averageDryEnergy}, Confused ${emotionalBaseline.averageConfused}.
  `.trim();
}

/**
 * Get user profile (cached)
 */
export async function getUserProfile(userId) {
  return await prisma.userAIProfile.findUnique({
    where: { userId },
  });
}

/**
 * Get emotional trendline over time
 */
export async function getEmotionalTrendline(userId, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const analyses = await prisma.analysisReport.findMany({
    where: {
      userId,
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'asc' },
  });

  return analyses.map(analysis => {
    const summary = analysis.geminiSummary || {};
    const metrics = summary.metrics || {};
    
    return {
      date: analysis.createdAt,
      flirty: metrics.flirty || 0,
      angry: metrics.angry || 0,
      friendly: metrics.friendly || 0,
      romantic: metrics.romantic || 0,
      dryEnergy: metrics.dry_energy || 0,
      confused: metrics.confused || 0,
    };
  });
}

