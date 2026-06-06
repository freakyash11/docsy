/**
 * jobs/processors/emailProcessor.js
 *
 * Pure processing function for email jobs.
 * Kept separate from the worker so it can be unit-tested in isolation.
 *
 * Receives a BullMQ Job with data:
 *  {
 *    type     : string
 *    to       : string
 *    subject  : string
 *    template : string
 *    context  : object
 *  }
 *
 * Returns { success: boolean, messageId?: string } on success.
 * Throws on failure so BullMQ can apply its retry strategy.
 */

import { emailService } from '../../services/emailService.js';

/**
 * @param {import('bullmq').Job} job
 */
export async function processEmailJob(job) {
  const { type, to, subject, template, context } = job.data;

  console.log(
    `[emailProcessor] Processing job ${job.id} — type: ${type} | to: ${to} | attempt: ${job.attemptsMade + 1}`
  );

  // Validate required fields defensively (belt-and-suspenders)
  if (!to || !subject || !template) {
    throw new Error(
      `[emailProcessor] Job ${job.id} is missing required fields (to, subject, template).`
    );
  }

  const result = await emailService.sendEmail({ to, subject, template, context });

  if (!result.success) {
    // Throw so BullMQ marks this attempt as failed and schedules a retry
    throw new Error(
      `[emailProcessor] SendGrid failed for job ${job.id}: ${result.error}`
    );
  }

  console.log(
    `[emailProcessor] Job ${job.id} completed — messageId: ${result.messageId}`
  );

  return { success: true, messageId: result.messageId };
}
