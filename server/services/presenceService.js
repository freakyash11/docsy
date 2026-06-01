/**
 * PresenceService
 *
 * Single source of truth for collaborator presence tracking.
 * Backed by Redis Hashes for cross-process durability and
 * compatibility with the existing Socket.IO Redis adapter.
 *
 * ─── Key Strategy ────────────────────────────────────────────────
 *
 *  Hash (primary store):
 *    Key   : presence:doc:{documentId}
 *    Field : {mongoUserId}
 *    Value : JSON string  →  { socketId, userId, mongoUserId,
 *                              email, name, role, connectedAt }
 *
 *  String (reverse-lookup — socketId → location):
 *    Key   : presence:sock:{socketId}
 *    Value : "{mongoUserId}:{documentId}"
 *
 *  String (socket tombstone — TTL-bounded connection record):
 *    Key   : presence:socket:{socketId}        TTL: 90 s
 *    Value : JSON string  →  { documentId, mongoUserId, createdAt }
 *
 *  Tombstones act as a soft proof-of-life per socket. A key expiring
 *  means the socket has been silent for longer than the TTL window.
 *  Heartbeats (future) will call refreshSocketTombstone() to reset
 *  the TTL on each ping. Cleanup workers (future) can scan for stale
 *  presence entries whose tombstone no longer exists.
 *
 *  The reverse-lookup lets removeUser resolve the correct hash field
 *  in O(1) using only the socketId that the disconnect handler has,
 *  without scanning the full hash.
 *
 * ─────────────────────────────────────────────────────────────────
 *
 * Presence entry shape (stored as JSON in each hash field):
 *   {
 *     socketId:    string,
 *     userId:      string,   // Clerk ID
 *     mongoUserId: string,   // MongoDB _id  (also the hash field)
 *     email:       string,
 *     name:        string,
 *     role:        string,   // 'owner' | 'editor' | 'viewer'
 *     connectedAt: string    // ISO-8601 timestamp
 *   }
 */

/** @type {import('ioredis').Redis | null} */
let redisClient = null;

// ─── Key helpers ──────────────────────────────────────────────────

/** Primary presence hash for a document. */
const docKey = (documentId) => `presence:doc:${documentId}`;

/** Reverse-lookup key so we can find a user by socketId alone. */
const sockKey = (socketId) => `presence:sock:${socketId}`;

/**
 * Tombstone key — a TTL-bounded record proving a socket is alive.
 * Intentionally uses a different prefix segment ("socket" vs "sock")
 * to keep tombstones and reverse-lookup strings scannable separately.
 */
const tombstoneKey = (socketId) => `presence:socket:${socketId}`;

/** TTL applied to every socket tombstone, in seconds. */
const TOMBSTONE_TTL_SECONDS = 90;

// ─── Module initialisation ────────────────────────────────────────

/**
 * Initialise the service with a live ioredis client.
 * Must be called once before any other method.
 *
 * @param {import('ioredis').Redis} client
 */
function init(client) {
  redisClient = client;
  console.log('[PresenceService] Initialised with Redis client');
}

/** Throws if init() was not called first. */
function assertReady() {
  if (!redisClient) {
    throw new Error('[PresenceService] Redis client not initialised — call PresenceService.init(redisClient) first');
  }
}

// ─── Public API ───────────────────────────────────────────────────

const PresenceService = {
  init,

  /**
   * Add (or update on reconnection) a user in a document's presence hash.
   * Upsert is keyed on mongoUserId so reconnections overwrite stale data.
   *
   * Also writes the reverse-lookup key for O(1) removeUser.
   *
   * @param {string} documentId
   * @param {{ socketId, userId, mongoUserId, email, name, role }} presenceData
   * @returns {Promise<{ socketId, userId, mongoUserId, email, name, role, connectedAt }[]>}
   *          Full updated presence list for the document.
   */
  async addUser(documentId, presenceData) {
    assertReady();

    const entry = {
      ...presenceData,
      connectedAt: new Date().toISOString(),
    };

    const pipeline = redisClient.pipeline();

    // Upsert this user's field in the document hash
    pipeline.hset(docKey(documentId), presenceData.mongoUserId, JSON.stringify(entry));

    // Write reverse-lookup:  socketId  →  "mongoUserId:documentId"
    pipeline.set(sockKey(presenceData.socketId), `${presenceData.mongoUserId}:${documentId}`);

    await pipeline.exec();

    // Return full list so callers can log count, etc.
    return PresenceService.getAllRaw(documentId);
  },

  /**
   * Update arbitrary fields on an existing presence entry located by socketId.
   * Uses the reverse-lookup key to find the hash field without scanning.
   *
   * @param {string} documentId
   * @param {string} socketId
   * @param {Partial<PresenceEntry>} updates
   * @returns {Promise<object|null>} The updated entry, or null if not found.
   */
  async updateUser(documentId, socketId, updates) {
    assertReady();

    const lookupVal = await redisClient.get(sockKey(socketId));
    if (!lookupVal) return null;

    const [mongoUserId] = lookupVal.split(':');
    const raw = await redisClient.hget(docKey(documentId), mongoUserId);
    if (!raw) return null;

    const entry = { ...JSON.parse(raw), ...updates };
    await redisClient.hset(docKey(documentId), mongoUserId, JSON.stringify(entry));
    return entry;
  },

  /**
   * Remove a user from a document's presence hash.
   * Uses the reverse-lookup key so we never have to scan the whole hash.
   * Cleans up both the hash field and the reverse-lookup string.
   *
   * @param {string} documentId
   * @param {string} socketId
   * @returns {Promise<void>}
   */
  async removeUser(documentId, socketId) {
    assertReady();

    const lookupVal = await redisClient.get(sockKey(socketId));
    if (!lookupVal) {
      console.log(`[PresenceService] No reverse-lookup found for socket ${socketId} — already removed?`);
      return;
    }

    const [mongoUserId] = lookupVal.split(':');

    const pipeline = redisClient.pipeline();
    pipeline.hdel(docKey(documentId), mongoUserId);   // Remove from hash
    pipeline.del(sockKey(socketId));                   // Remove reverse-lookup
    await pipeline.exec();

    console.log(`[PresenceService] Removed user ${mongoUserId} from doc ${documentId}`);
  },

  /**
   * Return the sanitised public representation of all active users
   * for a document (strips internal socketId and connectedAt fields).
   *
   * @param {string} documentId
   * @returns {Promise<{ email, userId, mongoUserId, name, role }[]>}
   */
  async getActiveUsers(documentId) {
    assertReady();

    const raw = await PresenceService.getAllRaw(documentId);
    return raw.map(({ email, userId, mongoUserId, name, role }) => ({
      email,
      userId,
      mongoUserId,
      name,
      role,
    }));
  },

  /**
   * Update only the role field for the user identified by socketId.
   *
   * @param {string} documentId
   * @param {string} socketId
   * @param {string} newRole
   * @returns {Promise<boolean>} Whether the update was applied.
   */
  async updateRole(documentId, socketId, newRole) {
    assertReady();

    const lookupVal = await redisClient.get(sockKey(socketId));
    if (!lookupVal) return false;

    const [mongoUserId] = lookupVal.split(':');
    const raw = await redisClient.hget(docKey(documentId), mongoUserId);
    if (!raw) return false;

    const entry = { ...JSON.parse(raw), role: newRole };
    await redisClient.hset(docKey(documentId), mongoUserId, JSON.stringify(entry));

    console.log(`[PresenceService] Updated role for ${mongoUserId} in doc ${documentId} → ${newRole}`);
    return true;
  },

  // ─── Socket tombstones ─────────────────────────────────────────
  //
  // Tombstones are INDEPENDENT of the presence hash. They are keyed
  // by socketId and carry a 90-second TTL. Their only purpose is to
  // record that a socket was alive at join time and (future) to let
  // heartbeats prove the socket is still connected.
  //
  // Tombstone key  :  presence:socket:{socketId}   (TTL = 90 s)
  // Tombstone value:  { documentId, mongoUserId, createdAt }

  /**
   * Create a socket tombstone when a user joins a document.
   * Sets a 90-second TTL. Idempotent — safe to call on reconnection.
   *
   * @param {string} socketId
   * @param {string} documentId
   * @param {string} mongoUserId
   * @returns {Promise<void>}
   */
  async createSocketTombstone(socketId, documentId, mongoUserId) {
    assertReady();

    const value = JSON.stringify({
      documentId,
      mongoUserId,
      createdAt: new Date().toISOString(),
    });

    // SET with EX so the key self-destructs if the socket goes silent
    await redisClient.set(tombstoneKey(socketId), value, 'EX', TOMBSTONE_TTL_SECONDS);

    console.log(`[PresenceService] Tombstone created for socket ${socketId} (TTL ${TOMBSTONE_TTL_SECONDS}s)`);
  },

  /**
   * Reset the TTL on an existing tombstone without changing its value.
   * Intended for future heartbeat handlers — calling this on every
   * ping keeps the key alive for as long as the socket is active.
   *
   * Returns false if the tombstone no longer exists (expired or
   * already removed), so callers can decide whether to recreate it.
   *
   * @param {string} socketId
   * @returns {Promise<boolean>} true if the TTL was reset, false if key missing.
   */
  async refreshSocketTombstone(socketId) {
    assertReady();

    // EXPIRE returns 1 if the key exists and was updated, 0 if not
    const result = await redisClient.expire(tombstoneKey(socketId), TOMBSTONE_TTL_SECONDS);
    const alive = result === 1;

    if (!alive) {
      console.log(`[PresenceService] Tombstone refresh failed — key missing for socket ${socketId}`);
    }

    return alive;
  },

  /**
   * Delete a socket tombstone on clean disconnect.
   * A no-op if the key has already expired — safe to call unconditionally
   * in the disconnect handler.
   *
   * @param {string} socketId
   * @returns {Promise<void>}
   */
  async removeSocketTombstone(socketId) {
    assertReady();

    await redisClient.del(tombstoneKey(socketId));

    console.log(`[PresenceService] Tombstone removed for socket ${socketId}`);
  },

  /**
   * Retrieve the tombstone payload for a socket, or null if it has
   * expired or was never created.
   *
   * Useful for cleanup workers and diagnostics.
   *
   * @param {string} socketId
   * @returns {Promise<{ documentId: string, mongoUserId: string, createdAt: string } | null>}
   */
  async getSocketTombstone(socketId) {
    assertReady();

    const raw = await redisClient.get(tombstoneKey(socketId));
    return raw ? JSON.parse(raw) : null;
  },

  // ─── Internal helpers ────────────────────────────────────────────

  /**
   * Fetch all raw presence entries (parsed from JSON) for a document.
   * Useful internally and for logging/debugging.
   *
   * @param {string} documentId
   * @returns {Promise<object[]>}
   */
  async getAllRaw(documentId) {
    assertReady();

    const hash = await redisClient.hgetall(docKey(documentId));
    if (!hash) return [];

    return Object.values(hash).map((v) => JSON.parse(v));
  },
};

export default PresenceService;
