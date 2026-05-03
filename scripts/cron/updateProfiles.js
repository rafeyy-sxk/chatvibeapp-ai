/**
 * Cron Job: Update User Profiles
 * 
 * Rebuilds user profiles with new analyses
 * Run daily at 2 AM
 */

import prisma from '../../lib/prisma';
import { buildUserProfile } from '../../lib/personalization/userModeling';
import { generateEmbedding } from '../../lib/personalization/embeddings';
import { log } from '../../lib/logger';

async function updateProfiles() {
  console.log('[cron] Starting profile update job...');
  
  try {
    // Get all users with analyses
    const users = await prisma.user.findMany({
      where: {
        analysisReports: {
          some: {},
        },
      },
      select: {
        id: true,
      },
    });

    console.log(`[cron] Found ${users.length} users to update`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        await buildUserProfile(user.id);
        successCount++;
        
        if (successCount % 10 === 0) {
          console.log(`[cron] Updated ${successCount}/${users.length} profiles...`);
        }
      } catch (error) {
        errorCount++;
        log.error(`Failed to update profile for user ${user.id}`, error);
      }
    }

    console.log(`[cron] Profile update complete: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    log.error('Profile update job failed', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateProfiles()
    .then(() => {
      console.log('[cron] Profile update job finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('[cron] Profile update job failed', error);
      process.exit(1);
    });
}

export default updateProfiles;

