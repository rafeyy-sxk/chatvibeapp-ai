/**
 * Personalization Integration
 * 
 * Helper functions to integrate personalization into the analysis flow
 */

import prisma from '../prisma';
import { generateEmbedding } from './embeddings';
import { extractAndUpdateRelationships } from './relationshipGraph';
import { generatePersonalizedAdvice } from './adaptiveAdvice';
import { extractChatFeatures } from './featureExtractor';
import { log } from '../logger';

/**
 * Process personalization for a completed analysis
 * @param {string} userId - User ID
 * @param {string} analysisReportId - Analysis report ID
 * @param {object} analysisReport - Analysis report object
 */
export async function processPersonalization(userId, analysisReportId, analysisReport) {
  try {
    const { ocrTranscript, geminiSummary, rawText } = analysisReport;

    // 1. Generate embedding for similarity search
    await generateAndStoreEmbedding(analysisReportId, ocrTranscript);

    // 2. Extract and update relationships
    await extractAndUpdateRelationships(
      userId,
      analysisReportId,
      ocrTranscript || rawText,
      geminiSummary
    );

    // 3. Store past analysis for model adaptation
    await storePastAnalysis(userId, analysisReportId, ocrTranscript || rawText, geminiSummary);

    // 4. Generate personalized advice (async, don't block)
    generatePersonalizedAdvice(userId, analysisReport, geminiSummary)
      .then(async (advice) => {
        // Store advice in advice history
        await prisma.adviceHistory.create({
          data: {
            userId,
            analysisReportId,
            adviceText: advice,
            adviceType: 'GENERAL',
          },
        });
      })
      .catch((error) => {
        log.error('Failed to generate personalized advice', error, { userId, analysisReportId });
      });

    log.debug('Personalization processed', { userId, analysisReportId });
  } catch (error) {
    log.error('Error processing personalization', error, { userId, analysisReportId });
    // Don't throw - personalization failures shouldn't break analysis
  }
}

/**
 * Generate and store embedding for analysis
 */
async function generateAndStoreEmbedding(analysisReportId, text) {
  try {
    if (!text || text.trim().length === 0) {
      return;
    }

    const embedding = await generateEmbedding(text);

    await prisma.userAIEmbedding.upsert({
      where: { analysisReportId },
      create: {
        analysisReportId,
        embedding: embedding,
        textChunk: text.substring(0, 1000), // First 1000 chars
        metadata: {
          createdAt: new Date().toISOString(),
          source: 'analysis_completion',
        },
      },
      update: {
        embedding: embedding,
        textChunk: text.substring(0, 1000),
        metadata: {
          updatedAt: new Date().toISOString(),
          source: 'analysis_completion',
        },
      },
    });
  } catch (error) {
    log.error('Failed to generate embedding', error, { analysisReportId });
    throw error;
  }
}

/**
 * Store past analysis for model adaptation
 */
async function storePastAnalysis(userId, analysisReportId, text, geminiSummary) {
  try {
    const features = extractChatFeatures(text, geminiSummary);

    await prisma.pastAnalysis.upsert({
      where: { analysisReportId },
      create: {
        userId,
        analysisReportId,
        extractedFeatures: features,
        modelVersion: '1.0.0',
      },
      update: {
        extractedFeatures: features,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    log.error('Failed to store past analysis', error, { userId, analysisReportId });
    throw error;
  }
}

