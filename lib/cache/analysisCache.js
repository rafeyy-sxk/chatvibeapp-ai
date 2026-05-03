import { getRedisClient } from "../redis.js";

const ANALYSIS_CACHE_TTL = 86400;
const PREFIX = "analysis:result";

export async function getCachedAnalysisResult(reportId) {
  try {
    const cached = await getRedisClient().get(`${PREFIX}:${reportId}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export async function setCachedAnalysisResult(reportId, result, ttl = ANALYSIS_CACHE_TTL) {
  try {
    await getRedisClient().setex(`${PREFIX}:${reportId}`, ttl, JSON.stringify(result));
  } catch {
    // cache write failure is non-fatal
  }
}

export async function invalidateAnalysisResult(reportId) {
  try {
    await getRedisClient().del(`${PREFIX}:${reportId}`);
  } catch {
    // ignore
  }
}

export async function batchGetCachedAnalysisResults(reportIds) {
  const results = new Map();
  if (reportIds.length === 0) return results;
  try {
    const keys = reportIds.map((id) => `${PREFIX}:${id}`);
    const values = await getRedisClient().mget(...keys);
    values.forEach((value, i) => {
      if (value) {
        try { results.set(reportIds[i], JSON.parse(value)); } catch { /* skip */ }
      }
    });
  } catch {
    // ignore
  }
  return results;
}
