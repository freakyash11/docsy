import { Worker } from 'bullmq';
import { VERSION_QUEUE_NAME } from '../queues/versionQueue.js';
import { processVersionJob } from '../processors/versionProcessor.js';
import { createBullMQConnection } from '../connection.js';

let versionWorker = null;

export function startVersionWorker({ concurrency = 2 } = {}) {
  if (versionWorker) {
    console.warn('[versionWorker] Worker is already running — skipping duplicate start.');
    return versionWorker;
  }

  const workerConnection = createBullMQConnection();

  versionWorker = new Worker(VERSION_QUEUE_NAME, processVersionJob, {
    connection: workerConnection,
    concurrency,
    stalledInterval: 30_000,
    maxStalledCount: 1,
  });

  versionWorker.on('active', (job) => {
    console.log(`[versionWorker] Job active — id: ${job.id} | name: ${job.name}`);
  });

  versionWorker.on('completed', (job, result) => {
    console.log(
      `[versionWorker] ✓ Job completed — id: ${job.id} | doc: ${job.data.documentId} | new version: ${result?.versionNumber}`
    );
  });

  versionWorker.on('failed', (job, err) => {
    const attemptsLeft = (job?.opts?.attempts ?? 3) - (job?.attemptsMade ?? 0);
    console.error(
      `[versionWorker] ✗ Job failed — id: ${job?.id} | doc: ${job?.data?.documentId} | ` +
      `attempt: ${job?.attemptsMade} | error: ${err.message}`
    );
    if (attemptsLeft <= 0) {
      console.error(`[versionWorker] ✗ Job ${job?.id} exhausted all retries.`, err.stack);
    }
  });

  versionWorker.on('stalled', (jobId) => {
    console.warn(`[versionWorker] ⚠ Job stalled — id: ${jobId}`);
  });

  versionWorker.on('error', (err) => {
    console.error('[versionWorker] Worker error:', err.message);
  });

  console.log(
    `[versionWorker] Worker started — queue: ${VERSION_QUEUE_NAME} | concurrency: ${concurrency}`
  );

  return versionWorker;
}

export async function stopVersionWorker() {
  if (!versionWorker) return;
  console.log('[versionWorker] Graceful shutdown initiated…');
  try {
    await versionWorker.close();
    console.log('[versionWorker] Worker closed gracefully.');
  } catch (err) {
    console.error('[versionWorker] Error during shutdown:', err.message);
  } finally {
    versionWorker = null;
  }
}
