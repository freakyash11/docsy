/**
 * jobs/index.js
 *
 * Central entry point for the BullMQ jobs system.
 *
 * Two usage modes:
 *
 *  1. Embedded in the API server (server.js):
 *     import { startWorkers, stopWorkers } from './jobs/index.js';
 *     startWorkers();
 *
 *  2. Standalone worker process (jobs/worker.js):
 *     Run `node server/jobs/worker.js`
 *
 * Add future workers here (aiWorker, cleanupWorker, etc.) by:
 *  - Importing their start/stop functions
 *  - Adding them to the arrays below
 */

import { startEmailWorker, stopEmailWorker } from './workers/emailWorker.js';
import { startVersionWorker, stopVersionWorker } from './workers/versionWorker.js';

// Re-export queue helpers so callers only need to import from 'jobs/index.js'
export { emailQueue, addEmailJob } from './queues/emailQueue.js';
export { versionQueue, addVersionJob } from './queues/versionQueue.js';

/** @type {Array<() => Promise<void>>} */
const stopHandlers = [];

let workersStarted = false;

/**
 * Start all registered workers.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startWorkers() {
  if (workersStarted) {
    console.warn('[jobs] Workers are already running — skipping duplicate start.');
    return;
  }

  console.log('[jobs] Starting background workers…');

  startEmailWorker({ concurrency: 5 });
  stopHandlers.push(stopEmailWorker);

  startVersionWorker({ concurrency: 2 });
  stopHandlers.push(stopVersionWorker);

  // Future workers:
  // startAiWorker();        stopHandlers.push(stopAiWorker);
  // startCleanupWorker();   stopHandlers.push(stopCleanupWorker);

  workersStarted = true;
  console.log('[jobs] All workers started.');
}

/**
 * Gracefully stop all registered workers.
 * Called automatically when the process receives SIGTERM / SIGINT.
 */
export async function stopWorkers() {
  if (!workersStarted) return;

  console.log('[jobs] Stopping all workers…');

  await Promise.allSettled(stopHandlers.map((stop) => stop()));

  workersStarted = false;
  console.log('[jobs] All workers stopped.');
}

// ── Process-level graceful shutdown ──────────────────────────────────────────
// Registered here so the jobs module owns its own teardown regardless of
// whether it is embedded in server.js or run as a standalone process.

async function handleShutdown(signal) {
  console.log(`\n[jobs] Received ${signal} — initiating graceful shutdown…`);
  await stopWorkers();
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT',  () => handleShutdown('SIGINT'));
