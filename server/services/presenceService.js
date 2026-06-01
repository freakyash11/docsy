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
