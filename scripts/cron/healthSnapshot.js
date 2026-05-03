/**
 * Cron Job: Collect System Health Snapshot
 * 
 * Collects system health metrics every 5 minutes
 * Run every 5 minutes
 */

import { collectHealthSnapshot } from '../../lib/admin/systemHealth';
import { log } from '../../lib/logger';

async function collectSnapshot() {
  console.log('[cron] Collecting system health snapshot...');
  
  try {
    const snapshot = await collectHealthSnapshot();
    console.log(`[cron] Health snapshot collected: ${snapshot.status}`, {
      timestamp: snapshot.timestamp,
      alerts: snapshot.alerts?.length || 0,
    });
  } catch (error) {
    log.error('Failed to collect health snapshot', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectSnapshot()
    .then(() => {
      console.log('[cron] Health snapshot job finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('[cron] Health snapshot job failed', error);
      process.exit(1);
    });
}

export default collectSnapshot;

