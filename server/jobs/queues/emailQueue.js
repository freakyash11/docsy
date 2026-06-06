/**
 * jobs/queues/emailQueue.js
 *
 * Email queue definition.
 *
 * Exposes:
 *  - emailQueue  : BullMQ Queue instance (for adding jobs)
 *  - addEmailJob : typed helper for enqueuing email jobs
 *
 * Job data schema:
 *  {
 *    type    : string   — job type key (e.g. 'invite', 'welcome', 'reset')
 *    to      : string   — recipient email address
 *    subject : string   — email subject line
 *    template: string   — Handlebars template name (matches templates/email/*.hbs)
 *    context : object   — template rendering context
 *  }
 */

import { Queue } from 'bullmq';
import { createBullMQConnection } from '../connection.js';

export const EMAIL_QUEUE_NAME = 'email';

// One connection instance for this queue
const queueConnection = createBullMQConnection();

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,   // First retry after 2 s, then 4 s, then 8 s
    },
    removeOnComplete: {
      age: 24 * 3600,   // Keep completed jobs for 24 h
      count: 500,        // Keep at most 500 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600,  // Keep failed jobs for 7 days for debugging
    },
  },
});

emailQueue.on('error', (err) => {
  console.error(`[${EMAIL_QUEUE_NAME} Queue] Error:`, err.message);
});

/**
 * Enqueue an email job.
 *
 * @param {string} type       - Logical job type label (e.g. 'invite', 'welcome')
 * @param {{ to: string, subject: string, template: string, context: object }} data
 * @param {import('bullmq').JobsOptions} [opts]  - Per-job BullMQ options override
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addEmailJob(type, data, opts = {}) {
  if (!data.to || !data.subject || !data.template) {
    throw new Error(
      '[emailQueue] addEmailJob requires { to, subject, template } at minimum.'
    );
  }

  const jobName = `email:${type}`;
  const job = await emailQueue.add(jobName, { type, ...data }, opts);

  console.log(
    `[emailQueue] Job queued — id: ${job.id} | type: ${type} | to: ${data.to}`
  );

  return job;
}
