/**
 * Cron Job: Cleanup Old Audit Logs
 * 
 * Removes audit logs older than 90 days (GDPR compliance)
 * Run daily at 3 AM
 */

import { cleanupOldAuditLogs } from '../../lib/admin/auditLog';
import { cleanupOldHealthSnapshots } from '../../lib/admin/systemHealth';
import { log } from '../../lib/logger';

async function cleanup() {
  console.log('[cron] Starting audit log cleanup...');
  
  try {
    const [auditCount, healthCount] = await Promise.all([
      cleanupOldAuditLogs(),
      cleanupOldHealthSnapshots(),
    ]);

    console.log(`[cron] Cleanup complete: ${auditCount} audit logs, ${healthCount} health snapshots deleted`);
  } catch (error) {
    log.error('Cleanup job failed', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanup()
    .then(() => {
      console.log('[cron] Cleanup job finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('[cron] Cleanup job failed', error);
      process.exit(1);
    });
}

export default cleanup;

