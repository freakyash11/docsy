import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  createDocument,
  getUserDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
} from '../controllers/documentController.js';
import { getDocumentCollaborators } from '../controllers/documentController.js';
import { 
  getDocumentVersions, 
  getDocumentVersion, 
  createDocumentVersion, 
  restoreVersion 
} from '../controllers/versionController.js';

const router = express.Router();

router.post('/', authMiddleware, createDocument);
router.get('/', authMiddleware, getUserDocuments);
router.get('/:id', getDocument);
router.get('/:id/collaborators', authMiddleware, getDocumentCollaborators);
router.patch('/:id', authMiddleware, updateDocument);
router.delete('/:id', authMiddleware, deleteDocument);

// Version history routes
router.get('/:id/versions', authMiddleware, getDocumentVersions);
router.get('/:id/versions/:versionId', authMiddleware, getDocumentVersion);
router.post('/:id/versions', authMiddleware, createDocumentVersion);
router.post('/:id/restore/:versionId', authMiddleware, restoreVersion);

export default router;