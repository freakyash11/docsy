/**
 * PresenceService
 *
 * Single source of truth for collaborator presence tracking.
 * Currently backed by an in-memory Map so existing behavior is
 * fully preserved. The public API is designed to be adapter-agnostic,
 * making a future Redis migration a drop-in replacement of this file only.
 *
 * Presence entry shape:
 *   {
 *     socketId:    string,
 *     userId:      string,   // Clerk ID
 *     mongoUserId: string,   // MongoDB _id
 *     email:       string,
 *     name:        string,
 *     role:        string    // 'owner' | 'editor' | 'viewer'
 *   }
 */

// In-memory store: { documentId -> PresenceEntry[] }
const documentPresence = new Map();

const PresenceService = {
  /**
   * Add a user to a document's presence list.
   * If the user (matched by mongoUserId) is already present
   * (e.g. reconnected from a different socket), their entry is
   * updated rather than duplicated.
   *
   * @param {string} documentId
   * @param {object} presenceData - Full presence entry object.
   * @returns {PresenceEntry[]} Updated presence list for the document.
   */
  addUser(documentId, presenceData) {
    const presenceList = documentPresence.get(documentId) || [];

    const existingIndex = presenceList.findIndex(
      (p) => p.mongoUserId === presenceData.mongoUserId
    );

    if (existingIndex >= 0) {
      // Update existing entry (handles re-connections)
      presenceList[existingIndex] = presenceData;
    } else {
      presenceList.push(presenceData);
    }

    documentPresence.set(documentId, presenceList);
    return presenceList;
  },

  /**
   * Update an existing presence entry identified by socketId.
   * Partial updates are merged into the existing entry.
   *
   * @param {string} documentId
   * @param {string} socketId
   * @param {Partial<PresenceEntry>} updates
   * @returns {PresenceEntry|null} The updated entry, or null if not found.
   */
  updateUser(documentId, socketId, updates) {
    const presenceList = documentPresence.get(documentId);
    if (!presenceList) return null;

    const entry = presenceList.find((p) => p.socketId === socketId);
    if (!entry) return null;

    Object.assign(entry, updates);
    documentPresence.set(documentId, presenceList);
    return entry;
  },

  /**
   * Remove a user from a document's presence list by socketId.
   * Cleans up the document key entirely when the list becomes empty.
   *
   * @param {string} documentId
   * @param {string} socketId
   * @returns {PresenceEntry[]} Remaining presence list (may be empty).
   */
  removeUser(documentId, socketId) {
    const presenceList = documentPresence.get(documentId) || [];
    const updatedList = presenceList.filter((p) => p.socketId !== socketId);

    if (updatedList.length === 0) {
      documentPresence.delete(documentId);
    } else {
      documentPresence.set(documentId, updatedList);
    }

    return updatedList;
  },

  /**
   * Return the sanitised public representation of all active users
   * for a given document (strips the internal socketId field).
   *
   * @param {string} documentId
   * @returns {{ email, userId, mongoUserId, name, role }[]}
   */
  getActiveUsers(documentId) {
    return (documentPresence.get(documentId) || []).map(
      ({ email, userId, mongoUserId, name, role }) => ({
        email,
        userId,
        mongoUserId,
        name,
        role,
      })
    );
  },

  /**
   * Update the role of a specific user (identified by socketId)
   * inside a document's presence list.
   *
   * @param {string} documentId
   * @param {string} socketId
   * @param {string} newRole
   * @returns {boolean} Whether the update was applied.
   */
  updateRole(documentId, socketId, newRole) {
    const presenceList = documentPresence.get(documentId);
    if (!presenceList) return false;

    const entry = presenceList.find((p) => p.socketId === socketId);
    if (!entry) return false;

    entry.role = newRole;
    documentPresence.set(documentId, presenceList);
    return true;
  },
};

export default PresenceService;
