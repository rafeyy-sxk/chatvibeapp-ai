export async function canCreateJob(_userId) {
  return { allowed: true };
}

export async function trackJobUsage(_userId, _jobId) {
  return { success: true };
}
