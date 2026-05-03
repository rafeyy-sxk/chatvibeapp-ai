/**
 * Memory-only placeholder middleware. Future milestones will plug this into
 * upload handlers to ensure files never touch disk.
 */
export function enforceMemoryOnlyUpload() {
  return {
    maxFiles: 10,
    maxTotalSize: 50 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg"],
  };
}

