/**
 * Feedback Loop System
 * 
 * Handles user feedback, model weight adjustment, and improvement tracking
 */

import prisma from '../prisma';
import { buildUserProfile } from './userModeling';
import { log } from '../logger';

/**
 * Record user feedback for an analysis
 * @param {string} userId - User ID
 * @param {string} analysisReportId - Analysis report ID
 * @param {object} feedback - Feedback data
 */
export async function recordFeedback(userId, analysisReportId, feedback) {
  const { rating, comment, wasHelpful, adviceType = 'GENERAL' } = feedback;

  // Validate feedback
  if (rating && (rating < 1 || rating > 5)) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Get or create advice history entry
  const existing = await prisma.adviceHistory.findFirst({
    where: {
      userId,
      analysisReportId,
    },
  });

  const adviceHistory = existing
    ? await prisma.adviceHistory.update({
        where: { id: existing.id },
        data: {
          userRating: rating || existing.userRating,
          userComment: comment || existing.userComment,
          wasHelpful: wasHelpful !== undefined ? wasHelpful : existing.wasHelpful,
          updatedAt: new Date(),
        },
      })
    : await prisma.adviceHistory.create({
        data: {
          userId,
          analysisReportId,
          adviceText: '', // Will be populated from analysis
          adviceType,
          userRating: rating,
          userComment: comment,
          wasHelpful: wasHelpful,
        },
      });

  // Update past analysis with feedback
  await prisma.pastAnalysis.upsert({
    where: { analysisReportId },
    create: {
      userId,
      analysisReportId,
      extractedFeatures: {}, // Will be populated
      userFeedback: {
        rating,
        comment,
        wasHelpful,
        timestamp: new Date().toISOString(),
      },
      modelVersion: '1.0.0',
    },
    update: {
      userFeedback: {
        rating,
        comment,
        wasHelpful,
        timestamp: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  });

  // Calculate model adjustment
  const modelAdjustment = calculateModelAdjustment(feedback);
  
  // Update advice history with model adjustment
  await prisma.adviceHistory.update({
    where: { id: adviceHistory.id },
    data: {
      modelAdjustment: modelAdjustment,
    },
  });

  // Trigger profile rebuild if significant feedback
  if (rating && (rating <= 2 || rating >= 4)) {
    // Rebuild profile asynchronously (don't block)
    rebuildProfileAsync(userId).catch(error => {
      log.error('Failed to rebuild profile after feedback', error, { userId });
    });
  }

  return adviceHistory;
}

/**
 * Calculate model adjustment based on feedback
 */
function calculateModelAdjustment(feedback) {
  const { rating, wasHelpful, comment } = feedback;
  
  const adjustment = {
    weightsChanged: false,
    promptModified: false,
    improvementScore: 0,
  };

  if (rating) {
    // Low rating = need to adjust weights
    if (rating <= 2) {
      adjustment.weightsChanged = true;
      adjustment.improvementScore = (5 - rating) / 5; // Higher score = more improvement needed
    } else if (rating >= 4) {
      // High rating = current weights are good
      adjustment.improvementScore = rating / 5;
    }
  }

  if (wasHelpful === false) {
    adjustment.promptModified = true;
    adjustment.improvementScore = Math.max(adjustment.improvementScore, 0.3);
  }

  if (comment && comment.length > 10) {
    // Comments indicate specific areas for improvement
    adjustment.promptModified = true;
  }

  return adjustment;
}

/**
 * Rebuild user profile asynchronously
 */
async function rebuildProfileAsync(userId) {
  try {
    await buildUserProfile(userId);
    log.debug('Profile rebuilt after feedback', { userId });
  } catch (error) {
    log.error('Error rebuilding profile', error, { userId });
    throw error;
  }
}

/**
 * Get feedback statistics for user
 */
export async function getFeedbackStats(userId) {
  const feedbacks = await prisma.adviceHistory.findMany({
    where: { userId },
  });

  if (feedbacks.length === 0) {
    return {
      totalFeedback: 0,
      averageRating: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      improvementTrend: 'stable',
    };
  }

  const ratings = feedbacks.filter(f => f.userRating).map(f => f.userRating);
  const helpful = feedbacks.filter(f => f.wasHelpful === true).length;
  const notHelpful = feedbacks.filter(f => f.wasHelpful === false).length;

  // Calculate improvement trend (comparing recent vs older feedback)
  const sortedFeedbacks = feedbacks.sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );
  const recentCount = Math.min(10, Math.floor(sortedFeedbacks.length / 2));
  const recentRatings = sortedFeedbacks.slice(-recentCount)
    .filter(f => f.userRating)
    .map(f => f.userRating);
  const olderRatings = sortedFeedbacks.slice(0, -recentCount)
    .filter(f => f.userRating)
    .map(f => f.userRating);

  const recentAvg = recentRatings.length > 0
    ? recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length
    : 0;
  const olderAvg = olderRatings.length > 0
    ? olderRatings.reduce((a, b) => a + b, 0) / olderRatings.length
    : 0;

  let improvementTrend = 'stable';
  if (recentAvg > olderAvg + 0.3) {
    improvementTrend = 'improving';
  } else if (recentAvg < olderAvg - 0.3) {
    improvementTrend = 'declining';
  }

  return {
    totalFeedback: feedbacks.length,
    averageRating: ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0,
    helpfulCount: helpful,
    notHelpfulCount: notHelpful,
    improvementTrend,
    recentAverageRating: recentAvg,
    olderAverageRating: olderAvg,
  };
}

/**
 * Get improvement score over time
 */
export async function getImprovementScore(userId, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const feedbacks = await prisma.adviceHistory.findMany({
    where: {
      userId,
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'asc' },
  });

  return feedbacks.map(f => ({
    date: f.createdAt,
    rating: f.userRating,
    wasHelpful: f.wasHelpful,
    improvementScore: f.modelAdjustment?.improvementScore || 0,
  }));
}

/**
 * Get model weights for user (for personalization)
 */
export async function getModelWeights(userId) {
  // Get recent feedback to determine weights
  const recentFeedbacks = await prisma.adviceHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (recentFeedbacks.length === 0) {
    // Default weights
    return {
      personalityWeight: 0.3,
      communicationStyleWeight: 0.3,
      pastSimilarityWeight: 0.2,
      emotionalBaselineWeight: 0.2,
    };
  }

  // Calculate weights based on feedback
  const avgRating = recentFeedbacks
    .filter(f => f.userRating)
    .map(f => f.userRating)
    .reduce((a, b) => a + b, 0) / recentFeedbacks.filter(f => f.userRating).length || 3;

  // Higher ratings = trust user profile more
  const profileWeight = Math.min(avgRating / 5, 0.6);
  const similarityWeight = 1 - profileWeight;

  return {
    personalityWeight: profileWeight * 0.4,
    communicationStyleWeight: profileWeight * 0.3,
    pastSimilarityWeight: similarityWeight * 0.5,
    emotionalBaselineWeight: profileWeight * 0.3,
  };
}

