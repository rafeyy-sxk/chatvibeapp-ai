/**
 * Cron Job: Rebuild Embeddings
 * 
 * Regenerates embeddings for all analyses
 * Run weekly on Sunday at 3 AM
 */

import prisma from '../../lib/prisma';
import { generateEmbedding } from '../../lib/personalization/embeddings';
import { log } from '../../lib/logger';

async function rebuildEmbeddings() {
  console.log('[cron] Starting embedding rebuild job...');
  
  try {
    // Get all analyses without embeddings or with old embeddings
    const analyses = await prisma.analysisReport.findMany({
      where: {
        OR: [
          { embedding: null },
          { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Last 7 days
        ],
      },
      include: {
        embedding: true,
      },
      take: 1000, // Process in batches
    });

    console.log(`[cron] Found ${analyses.length} analyses to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const analysis of analyses) {
      try {
        // Generate embedding for OCR transcript
        const embedding = await generateEmbedding(analysis.ocrTranscript);

        // Upsert embedding
        await prisma.userAIEmbedding.upsert({
          where: { analysisReportId: analysis.id },
          create: {
            analysisReportId: analysis.id,
            embedding: embedding,
            textChunk: analysis.ocrTranscript.substring(0, 1000), // First 1000 chars
            metadata: {
              createdAt: new Date().toISOString(),
              source: 'cron_rebuild',
            },
          },
          update: {
            embedding: embedding,
            textChunk: analysis.ocrTranscript.substring(0, 1000),
            metadata: {
              updatedAt: new Date().toISOString(),
              source: 'cron_rebuild',
            },
          },
        });

        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`[cron] Processed ${successCount}/${analyses.length} embeddings...`);
        }
      } catch (error) {
        errorCount++;
        log.error(`Failed to rebuild embedding for analysis ${analysis.id}`, error);
      }
    }

    console.log(`[cron] Embedding rebuild complete: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    log.error('Embedding rebuild job failed', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  rebuildEmbeddings()
    .then(() => {
      console.log('[cron] Embedding rebuild job finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('[cron] Embedding rebuild job failed', error);
      process.exit(1);
    });
}

export default rebuildEmbeddings;

