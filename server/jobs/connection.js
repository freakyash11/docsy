/**
 * jobs/connection.js
 *
 * Shared ioredis connection factory for BullMQ.
 *
 * BullMQ requires separate connection instances for Queue and Worker
 * (they use different Redis commands). This module provides a factory
 * so each consumer can get a fresh connection with the same config.
 *
 * Rules:
 *  - enableOfflineQueue: false  → fail fast if Redis is down
 *  - maxRetriesPerRequest: null → required by BullMQ workers
 *  - lazyConnect: true          → don't connect until first command
 */

import { Redis } from 'ioredis';

/**
 * Returns a new ioredis connection configured for BullMQ.
 * Call this once per Queue and once per Worker.
 *
 * @returns {Redis}
 */
export function createBullMQConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      '[BullMQ] REDIS_URL environment variable is not set. ' +
      'Add it to your .env file before starting workers.'
    );
  }

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,   // Required by BullMQ
    enableOfflineQueue: false,    // Surface connection errors immediately
    lazyConnect: true,
    // TLS is automatically handled when the URL scheme is rediss://
  });

  connection.on('connect', () => {
    console.log('[BullMQ Redis] Connection established');
  });

  connection.on('error', (err) => {
    console.error('[BullMQ Redis] Connection error:', err.message);
  });

  connection.on('close', () => {
    console.warn('[BullMQ Redis] Connection closed');
  });

  return connection;
}
