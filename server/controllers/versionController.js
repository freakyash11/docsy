import Version from '../models/Version.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { addVersionJob } from '../jobs/index.js';

// Get list of versions for a document
export const getDocumentVersions = async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions
    const isOwner = document.ownerId.toString() === mongoUserId.toString();
    const isCollaborator = document.collaborators.some(
      collab => collab.userId && collab.userId.toString() === mongoUserId.toString()
    );

    if (!isOwner && !isCollaborator && !document.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch versions without snapshot data for listing performance
    const versions = await Version.find({ documentId })
      .select('-snapshot')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ versions });
  } catch (error) {
    console.error('getDocumentVersions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
};

// Get a single version's details and snapshot
export const getDocumentVersion = async (req, res) => {
  try {
    const { id: documentId, versionId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({ error: 'Invalid document ID or version ID' });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions
    const isOwner = document.ownerId.toString() === mongoUserId.toString();
    const isCollaborator = document.collaborators.some(
      collab => collab.userId && collab.userId.toString() === mongoUserId.toString()
    );

    if (!isOwner && !isCollaborator && !document.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const version = await Version.findOne({ _id: versionId, documentId })
      .populate('createdBy', 'name email');

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ version });
  } catch (error) {
    console.error('getDocumentVersion error:', error.message);
    res.status(500).json({ error: 'Failed to fetch version' });
  }
};

// Create a version snapshot manually
export const createDocumentVersion = async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const { label, triggerSource = 'manual' } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions (only editors/owners can create snapshots)
    const isOwner = document.ownerId.toString() === mongoUserId.toString();
    const isEditor = document.collaborators.some(
      collab => collab.userId && collab.userId.toString() === mongoUserId.toString() && collab.permission === 'editor'
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ error: 'Access denied to create version' });
    }

    // Add version job to queue
    const job = await addVersionJob(documentId, document.data, triggerSource, mongoUserId, label);

    res.status(202).json({ success: true, message: 'Version creation queued', jobId: job.id });
  } catch (error) {
    console.error('createDocumentVersion error:', error.message);
    res.status(500).json({ error: 'Failed to create version' });
  }
};

// Restore a document to a specific version
export const restoreVersion = async (req, res) => {
  try {
    const { id: documentId, versionId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({ error: 'Invalid document ID or version ID' });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions (only editors/owners can restore)
    const isOwner = document.ownerId.toString() === mongoUserId.toString();
    const isEditor = document.collaborators.some(
      collab => collab.userId && collab.userId.toString() === mongoUserId.toString() && collab.permission === 'editor'
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ error: 'Access denied to restore version' });
    }

    const version = await Version.findOne({ _id: versionId, documentId });
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // 1. Create a pre-restore backup version asynchronously
    await addVersionJob(documentId, document.data, 'restore', mongoUserId, `Pre-restore (Before v${version.versionNumber})`);

    // 2. Restore document data
    document.data = version.snapshot;
    document.lastModifiedBy = mongoUserId;
    await document.save();

    console.log(`Document ${documentId} restored to version ${version.versionNumber} by user ${mongoUserId}`);

    // 3. Emit socket event for connected clients to reload
    // We use the same load-document payload format
    const io = req.app.get('io');
    if (io) {
      // It's tricky to inject the right roles and onlineUsers here for all clients,
      // so the best approach initially is to tell clients "document-restored" and they reload,
      // or we just emit the data and hope the client sets it.
      // The user specified "Use existing load-document flow for restore initially".
      // Let's emit a 'document-restored' event which the client will listen to,
      // and upon receiving it, the client can request the new document state or apply it directly.
      io.to(documentId).emit('document-restored', {
        data: document.data,
        title: document.title,
        versionNumber: version.versionNumber
      });
    }

    res.json({ success: true, message: `Document restored to version ${version.versionNumber}` });
  } catch (error) {
    console.error('restoreVersion error:', error.message);
    res.status(500).json({ error: 'Failed to restore version' });
  }
};
