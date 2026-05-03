/**
 * Email Worker - Processes email jobs
 * Example of how to create a worker for a new job type
 */

import { sendEmail } from "../../lib/email";
import { log } from "../../lib/logger";

/**
 * Process email job
 */
export async function processEmailJob(job) {
  const { to, subject, template, data } = job.data;

  try {
    log.info("Processing email job", { jobId: job.id, to, template });

    // Update progress
    await job.updateProgress(10);

    // Send email
    await sendEmail({
      to,
      subject,
      template, // e.g., "welcome", "password-reset", "analysis-complete"
      data, // Template variables
    });

    await job.updateProgress(100);

    log.info("Email sent successfully", { jobId: job.id, to });

    return { success: true, sentAt: new Date() };
  } catch (error) {
    log.error("Email job failed", error, { jobId: job.id, to });
    throw error;
  }
}
