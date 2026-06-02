/**
 * aiController.js
 *
 * Thin HTTP handler for AI actions.
 *
 * Pipeline per request:
 *   1. Validate action param and request body
 *   2. Check Redis cache (deterministic key from action + text + options)
 *   3. Call aiService.processAiAction() on cache miss
 *   4. Write result to Redis cache with action-specific TTL
 *   5. Return clean JSON to client
 *
 * All typed errors from aiService are translated to safe HTTP responses.
 * Raw error messages from the AI provider are never exposed to the client.
 */

import {
  processAiAction,
  buildCacheKey,
  CACHE_TTLS,
  VALID_ACTIONS,
  MAX_TEXT_LENGTH,
  AiInvalidInputError,
  AiUnavailableError,
  AiTimeoutError,
} from '../services/aiService.js';

/**
 * POST /api/ai/:action
 *
 * Body:
 *   { text: string, options?: { tone?: string, targetLanguage?: string } }
 *
 * Response:
 *   { success, action, result, cached, modelUsed, tokensUsed }
 */
export const handleAiAction = async (req, res) => {
  const { action } = req.params;

  // ── 1. Validate action ───────────────────────────────────────────
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ACTION',
      message: `Unknown action "${action}". Valid actions: ${VALID_ACTIONS.join(', ')}`,
    });
  }

  const { text, options = {} } = req.body;

  // ── 2. Validate body ─────────────────────────────────────────────
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_TEXT',
      message: 'text is required and must be a non-empty string.',
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: 'TEXT_TOO_LONG',
      message: `text exceeds the maximum length of ${MAX_TEXT_LENGTH} characters.`,
    });
  }

  // Action-specific option validation (before hitting the AI)
  if (action === 'tone') {
    const validTones = ['formal', 'casual', 'persuasive', 'empathetic', 'professional', 'friendly'];
    if (!options.tone || !validTones.includes(options.tone)) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_OPTION',
        message: `options.tone is required for the "tone" action. Valid tones: ${validTones.join(', ')}`,
      });
    }
  }

  if (action === 'translate') {
    if (!options.targetLanguage || typeof options.targetLanguage !== 'string' || !options.targetLanguage.trim()) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_OPTION',
        message: 'options.targetLanguage is required for the "translate" action.',
      });
    }
  }

  // ── 3. Redis cache lookup ────────────────────────────────────────
  const redis = req.app.get('redis');
  const cacheKey = buildCacheKey(action, text.trim(), options);
  let cached = false;

  if (redis) {
    try {
      const hit = await redis.get(cacheKey);
      if (hit) {
        const parsed = JSON.parse(hit);
        console.log(`[AiController] Cache HIT for action=${action} key=${cacheKey.slice(-8)}`);
        return res.json({
          success: true,
          action,
          result: parsed.result,
          cached: true,
          modelUsed: parsed.modelUsed,
          tokensUsed: parsed.tokensUsed ?? null,
        });
      }
    } catch (cacheErr) {
      // Non-fatal — proceed without cache
      console.warn('[AiController] Redis cache read error:', cacheErr.message);
    }
  }

  // ── 4. Call AI service ───────────────────────────────────────────
  console.log(`[AiController] Cache MISS — calling AI for action=${action} userId=${req.userId} textLen=${text.length}`);

  try {
    const { result, modelUsed, tokensUsed } = await processAiAction(action, text.trim(), options);

    // ── 5. Write to cache ──────────────────────────────────────────
    if (redis) {
      const ttl = CACHE_TTLS[action] ?? 1_800;
      const cachePayload = JSON.stringify({ result, modelUsed, tokensUsed, cachedAt: new Date().toISOString() });
      redis.setex(cacheKey, ttl, cachePayload).catch(err =>
        console.warn('[AiController] Redis cache write error:', err.message)
      );
    }

    return res.json({
      success: true,
      action,
      result,
      cached: false,
      modelUsed,
      tokensUsed: tokensUsed ?? null,
    });

  } catch (err) {
    // ── Error translation ──────────────────────────────────────────
    if (err instanceof AiInvalidInputError) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: err.message,
      });
    }

    if (err instanceof AiTimeoutError) {
      console.error(`[AiController] Timeout for action=${action} userId=${req.userId}`);
      return res.status(504).json({
        success: false,
        error: 'AI_TIMEOUT',
        message: 'The AI service took too long to respond. Please try again.',
      });
    }

    if (err instanceof AiUnavailableError) {
      console.error(`[AiController] AI unavailable for action=${action} userId=${req.userId}: ${err.message}`);
      return res.status(503).json({
        success: false,
        error: 'AI_UNAVAILABLE',
        message: 'The AI service is temporarily unavailable. Please try again later.',
      });
    }

    // Unexpected error — log full details server-side, return safe message
    console.error(`[AiController] Unexpected error for action=${action} userId=${req.userId}:`, err);
    return res.status(503).json({
      success: false,
      error: 'AI_UNAVAILABLE',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};
