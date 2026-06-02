/**
 * aiRoutes.js
 *
 * All AI action routes live here.
 * Auth + rate limiting are applied as middleware to every route.
 *
 * Mounted at /api/ai in server.js
 *   POST /api/ai/summarize
 *   POST /api/ai/grammar
 *   POST /api/ai/tone
 *   POST /api/ai/translate
 */

import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import aiRateLimit from '../middleware/aiRateLimit.js';
import { handleAiAction } from '../controllers/aiController.js';

const router = express.Router();

// All AI routes require Clerk authentication and per-user rate limiting
router.post('/:action', authMiddleware, aiRateLimit, handleAiAction);

export default router;
