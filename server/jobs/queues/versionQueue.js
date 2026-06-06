import { Queue } from 'bullmq';
import { createBullMQConnection } from '../connection.js';

export const VERSION_QUEUE_NAME = 'version';

// One connection instance for this queue
const queueConnection = createBullMQConnection();

export const versionQueue = new Queue(VERSION_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

versionQueue.on('error', (err) => {
  console.error(`[${VERSION_QUEUE_NAME} Queue] Error:`, err.message);
});

/**
 * Enqueue a version snapshot job.
 *
 * @param {string} documentId  - The ID of the document
 * @param {object} snapshot    - The Quill delta data
 * @param {string} triggerSource - 'manual' | 'periodic' | 'ai-edit' | 'restore'
 * @param {string} createdBy   - The ID of the user triggering the version
 * @param {string} [label]     - Optional custom label for the version
 * @param {import('bullmq').JobsOptions} [opts]
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addVersionJob(documentId, snapshot, triggerSource, createdBy, label = null, opts = {}) {
  if (!documentId || !snapshot || !triggerSource || !createdBy) {
    throw new Error(
      '[versionQueue] addVersionJob requires documentId, snapshot, triggerSource, and createdBy.'
    );
  }

  const jobName = `version:${documentId}:${triggerSource}`;
  const job = await versionQueue.add(jobName, {
    documentId,
    snapshot,
    triggerSource,
    createdBy,
    label
  }, opts);

  console.log(
    `[versionQueue] Job queued — id: ${job.id} | doc: ${documentId} | trigger: ${triggerSource}`
  );

  return job;
}
