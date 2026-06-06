/**
 * jobs/worker.js
 *
 * Standalone worker process entry point.
 *
 * Run this separately from the API server when you want to decouple
 * job processing from HTTP request handling (recommended for production):
 *
 *   node server/jobs/worker.js
 *
 * Or add a dedicated npm script:
 *   "worker": "node server/jobs/worker.js"
 *
 * This file:
 *  1. Loads environment variables
 *  2. Connects to MongoDB (some processors may need it, e.g. cleanup jobs)
 *  3. Starts all registered workers via jobs/index.js
 *  4. Keeps the process alive until SIGTERM / SIGINT
 */

import 'dotenv/config';
import connectDB from '../config/db.js';
import { startWorkers } from './index.js';

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Docsy — BullMQ Worker Process        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`[worker] Starting at ${new Date().toISOString()}`);
  console.log(`[worker] Node version: ${process.version}`);
  console.log(`[worker] PID: ${process.pid}`);

  // Connect to MongoDB (required for processors that query the DB)
  try {
    await connectDB();
    console.log('[worker] MongoDB connected');
  } catch (err) {
    console.error('[worker] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Start all BullMQ workers
  startWorkers();

  console.log('[worker] Worker process is ready and listening for jobs.');
}

main().catch((err) => {
  console.error('[worker] Fatal startup error:', err);
  process.exit(1);
});
