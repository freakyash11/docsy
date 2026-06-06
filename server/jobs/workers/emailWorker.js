/**
 * jobs/workers/emailWorker.js
 *
 * BullMQ Worker for the email queue.
 *
 * Responsibilities:
 *  - Pull jobs from the email queue
 *  - Delegate processing to emailProcessor
 *  - Log completed / failed / stalled events
 *  - Expose graceful shutdown via stopEmailWorker()
 *
 * Can be imported by:
 *  - jobs/index.js  (when running workers alongside the API server)
 *  - jobs/worker.js (when running as a standalone worker process)
 */

import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue.js';
import { processEmailJob } from '../processors/emailProcessor.js';
import { createBullMQConnection } from '../connection.js';

let emailWorker = null;

/**
 * Create and start the email worker.
 *
 * @param {{ concurrency?: number }} [options]
 * @returns {Worker}
 */
export function startEmailWorker({ concurrency = 5 } = {}) {
  if (emailWorker) {
    console.warn('[emailWorker] Worker is already running — skipping duplicate start.');
    return emailWorker;
  }

  const workerConnection = createBullMQConnection();

  emailWorker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: workerConnection,
    concurrency,
    // Stalled job detection — reclaim jobs that got stuck mid-flight
    stalledInterval: 30_000,     // Check every 30 s
    maxStalledCount: 1,          // Move to failed after 1 stall
  });

  // ── Event handlers ─────────────────────────────────────────────────────────

  emailWorker.on('active', (job) => {
    console.log(`[emailWorker] Job active — id: ${job.id} | name: ${job.name}`);
  });

  emailWorker.on('completed', (job, result) => {
    console.log(
      `[emailWorker] ✓ Job completed — id: ${job.id} | type: ${job.data.type} | to: ${job.data.to}`,
      result
    );
  });

  emailWorker.on('failed', (job, err) => {
    const attemptsLeft = (job?.opts?.attempts ?? 3) - (job?.attemptsMade ?? 0);

    console.error(
      `[emailWorker] ✗ Job failed — id: ${job?.id} | type: ${job?.data?.type} | ` +
      `attempt: ${job?.attemptsMade} | attemptsLeft: ${attemptsLeft} | error: ${err.message}`
    );

    // Log full stack for the final failure (no retries left)
    if (attemptsLeft <= 0) {
      console.error(`[emailWorker] ✗ Job ${job?.id} exhausted all retries.`, err.stack);
    }
  });

  emailWorker.on('stalled', (jobId) => {
    console.warn(`[emailWorker] ⚠ Job stalled — id: ${jobId}`);
  });

  emailWorker.on('error', (err) => {
    console.error('[emailWorker] Worker error:', err.message);
  });

  console.log(
    `[emailWorker] Worker started — queue: ${EMAIL_QUEUE_NAME} | concurrency: ${concurrency}`
  );

  return emailWorker;
}

/**
 * Gracefully stop the email worker.
 * Waits for in-flight jobs to finish before disconnecting.
 *
 * @returns {Promise<void>}
 */
export async function stopEmailWorker() {
  if (!emailWorker) return;

  console.log('[emailWorker] Graceful shutdown initiated…');

  try {
    await emailWorker.close();
    console.log('[emailWorker] Worker closed gracefully.');
  } catch (err) {
    console.error('[emailWorker] Error during shutdown:', err.message);
  } finally {
    emailWorker = null;
  }
}
