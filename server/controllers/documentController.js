import Document from '../models/Document.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

export const createDocument = async (req, res) => {
  try {
    console.log('createDocument called - userId:', req.userId, 'Body:', req.body);
    const { title } = req.body;
    
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Find or create User with clerkId
    let user = await User.findOne({ clerkId: req.userId });
    if (!user) {
      user = new User({
        clerkId: req.userId,
        name: 'Unknown User',
        email: 'unknown@example.com'
      });
      await user.save();
    }

    const document = new Document({
      title: title || 'Untitled Document',
      ownerId: user._id,
      lastModifiedBy: user._id,
      data: {}
    });
    
    await document.save();
    console.log('Document created successfully:', document._id);
    
    res.status(201).json({
      id: document._id,
      title: document.title,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      ownerId: document.ownerId
    });
  } catch (error) {
    console.error('Create document detailed error:', error.message, 'Stack:', error.stack);
    res.status(500).json({ error: 'Failed to create document' });
  }
};

export const getUserDocuments = async (req, res) => {
  try {
    console.log('getUserDocuments called - userId (Clerk ID):', req.userId);
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      console.log('No Mongo user found for Clerk ID:', userId);
      return res.status(404).json({ error: 'User not found in database' });
    }

    const mongoUserId = user._id;
    const mongoUserIdString = mongoUserId.toString();
    console.log('🔍 Current user MongoDB _id:', mongoUserIdString);

    // Use .lean() to get plain objects and avoid Mongoose schema issues
    const allDocuments = await Document.find({})
      .populate('ownerId', 'name email')
      .lean()  // ← This is the key - returns plain JS objects
      .sort({ updatedAt: -1 });

    console.log('📊 Total documents in DB:', allDocuments.length);

    // Debug: Log each document's details
    allDocuments.forEach((doc, index) => {
      console.log(`\n📄 Document ${index + 1}: ${doc._id}`);
      console.log(`   Title: "${doc.title}"`);
      console.log(`   OwnerId: ${doc.ownerId?._id?.toString()}`);
      console.log(`   Owner match: ${doc.ownerId?._id?.toString() === mongoUserIdString}`);
      console.log(`   Collaborators (${doc.collaborators?.length || 0}):`);
      
      if (doc.collaborators && doc.collaborators.length > 0) {
        doc.collaborators.forEach((collab, i) => {
          const collabUserId = collab.userId?.toString();
          const matches = collabUserId === mongoUserIdString;
          console.log(`     ${i + 1}. userId: ${collabUserId}, email: ${collab.email}, permission: ${collab.permission}`);
          console.log(`        Matches current user: ${matches}`);
        });
      } else {
        console.log('     (no collaborators)');
      }
    });

    // Filter documents where user is owner or collaborator
    const documents = allDocuments.filter(doc => {
      const docOwnerId = doc.ownerId?._id?.toString();
      const isOwner = docOwnerId === mongoUserIdString;
      
      const isCollaborator = doc.collaborators?.some(collab => {
        const collabUserId = collab.userId?.toString();
        return collabUserId === mongoUserIdString;
      });
      
      console.log(`🔍 Filtering ${doc._id}: isOwner=${isOwner}, isCollaborator=${isCollaborator}`);
      
      return isOwner || isCollaborator;
    });

    console.log('\n✅ Documents after filtering:', documents.length);

    const formattedDocs = documents.map(doc => {
      const isOwner = doc.ownerId?._id?.toString() === mongoUserIdString;
      
      return {
        id: doc._id.toString(),
        title: doc.title,
        owner: doc.ownerId?.name || 'Unknown',
        isOwner: isOwner,
        collaborators: doc.collaborators?.length || 0,
        isPublic: doc.isPublic,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      };
    });

    res.json({ documents: formattedDocs });
  } catch (error) {
    console.error('Get documents detailed error:', error.message, 'Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

// Get single document by ID
export const getDocument = async (req, res) => {
  try {
    console.log('getDocument called - id:', req.params.id, 'userId:', req.userId);
    const { id } = req.params;
    const userId = req.userId;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;

    const document = await Document.findById(id)
      .populate('ownerId', 'name email')
      .populate('collaborators.userId', 'name email')
      .populate('email clerkId');
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check permissions
    const isOwner = document.ownerId._id.toString() === mongoUserId.toString();
    const isCollaborator = document.collaborators.some(
      collab => collab.userId._id.toString() === mongoUserId.toString()
    );
    
    if (!isOwner && !isCollaborator && !document.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    console.log('Document fetched:', document._id);
    
    res.json({
      id: document._id,
      title: document.title,
      data: document.data,
      owner: document.ownerId.name,
      isOwner,
      collaborators: document.collaborators.map(collab => ({
        userId: collab.userId?._id,
        name: collab.userId.name,
        email: collab.userId.email,
        permission: collab.permission
      })),
      isPublic: document.isPublic,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    });
  } catch (error) {
    console.error('Get document detailed error:', error.message, 'Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

export const getDocumentCollaborators = async (req, res) => {
  try {
    console.log('=== DEBUG INFO START ===');
    console.log('Full req.userId:', req.userId);
    console.log('Type of req.userId:', typeof req.userId);
    console.log('req.user object:', JSON.stringify(req.user, null, 2));
    console.log('Authorization header:', req.headers.authorization);
    
    const { id } = req.params;
    const clerkUserId = req.userId;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    // Debug: Check what's actually in the database
    console.log('Searching for user with clerkId:', clerkUserId);
    const allUsers = await User.find({}).select('clerkId email name').limit(5);
    console.log('Sample users in DB:', JSON.stringify(allUsers, null, 2));
    
    // Find user making the request
    const user = await User.findOne({ clerkId: clerkUserId });
    console.log('User found:', user ? 'YES' : 'NO');
    console.log('=== DEBUG INFO END ===');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        debug: {
          searchedClerkId: clerkUserId,
          typeOfClerkId: typeof clerkUserId,
          sampleUsersInDb: allUsers.map(u => u.clerkId)
        }
      });
    }
    
    const mongoUserId = user._id;

    // Rest of your code...
    const document = await Document.findById(id)
      .populate('collaborators.userId', 'name email')
      .lean();
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const isOwner = document.ownerId.toString() === mongoUserId.toString();
    const isCollaborator = document.collaborators.some(
      collab => collab.userId?._id?.toString() === mongoUserId.toString()
    );
    
    if (!isOwner && !isCollaborator && !document.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const collaborators = document.collaborators.map(collab => ({
      id: collab._id,
      email: collab.email,
      name: collab.userId?.name || collab.email.split('@')[0],
      permission: collab.permission,
      userId: collab.userId?._id
    }));
    
    console.log('Collaborators fetched:', collaborators.length);
    
    res.json({
      document: {
        id: document._id,
        title: document.title,
        isPublic: document.isPublic,
        updatedAt: document.updatedAt
      },
      collaborators: collaborators,
      isOwner: isOwner
    });
  } catch (error) {
    console.error('Get collaborators error:', error.message, 'Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
};

// Update document (including title)
export const updateDocument = async (req, res) => {
  try {
    console.log('updateDocument called - id:', req.params.id, 'userId:', req.userId, 'Body:', req.body);
    const { id } = req.params;
    const { title, isPublic, collaborators } = req.body;
    const userId = req.userId;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;

    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only owner can update metadata
    if (document.ownerId.toString() !== mongoUserId.toString()) {
      return res.status(403).json({ error: 'Only owner can update document metadata' });
    }
    
    const updateData = { lastModifiedBy: mongoUserId };
    
    if (title !== undefined) updateData.title = title;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (collaborators !== undefined) updateData.collaborators = collaborators;
    
    const updatedDocument = await Document.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('ownerId', 'name email');
    
    console.log('Document updated:', updatedDocument._id);
    
    res.json({
      id: updatedDocument._id,
      title: updatedDocument.title,
      owner: updatedDocument.ownerId.name,
      isPublic: updatedDocument.isPublic,
      updatedAt: updatedDocument.updatedAt
    });
  } catch (error) {
    console.error('Update document detailed error:', error.message, 'Stack:', error.stack);
    res.status(500).json({ error: 'Failed to update document' });
  }
};

// PATCH: Update only document title (lightweight endpoint)
export const updateDocumentTitle = async (req, res) => {
  try {
    //console.log('updateDocument PATCH called - id:', req.params.id, 'userId:', req.userId, 'Body:', req.body);
    const { id } = req.params;
    const { title, isPublic, collaborators } = req.body;
    const userId = req.userId;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.ownerId.toString() !== mongoUserId.toString()) {
      return res.status(403).json({ error: 'Only document owner can update document settings' });
    }
    const updateData = { lastModifiedBy: mongoUserId };
    if (title !== undefined) {
      if (typeof title !== 'string') {
        return res.status(400).json({ error: 'Title must be a string' });
      }
      updateData.title = title.trim();
    }
    if (isPublic !== undefined) {
      updateData.isPublic = Boolean(isPublic);
    }
    if (collaborators !== undefined) {
      if (!Array.isArray(collaborators)) {
        return res.status(400).json({ error: 'Collaborators must be an array' });
      }
      
      // Process collaborators - find or create users by email
      const processedCollaborators = [];
      for (const collab of collaborators) {
        if (!collab.email) {
          continue; 
        }
        let collaboratorUser = await User.findOne({ email: collab.email });
        processedCollaborators.push({
          userId: collaboratorUser?._id || null,
          email: collab.email, // Always store email
          permission: collab.permission || 'viewer'
        });
      }
      
      updateData.collaborators = processedCollaborators;
      console.log('Processed collaborators:', processedCollaborators); // Debug log
    }
    
    // Update document
    Object.assign(document, updateData);
    await document.save();
    
    console.log('Document updated successfully:', document._id);
    
    res.json({
      success: true,
      id: document._id,
      title: document.title,
      isPublic: document.isPublic,
      collaborators: document.collaborators,
      updatedAt: document.updatedAt
    });
  } catch (error) {
    console.error('Update document error:', error.message, 'Stack:', error.stack);
    res.status(500).json({ error: 'Failed to update document' });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    console.log('deleteDocument called - id:', req.params.id, 'userId:', req.userId);
    const { id } = req.params;
    const userId = req.userId;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const mongoUserId = user._id;

    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only owner can delete
    if (document.ownerId.toString() !== mongoUserId.toString()) {
      return res.status(403).json({ error: 'Only owner can delete document' });
    }
    
    await Document.findByIdAndDelete(id);
    console.log('Document deleted:', id);
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document detailed error:', error.message, 'Stack:', error.stack);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};