/**
 * aiService.js
 *
 * Sends AI requests to OpenRouter using an OpenAI-compatible API.
 * Implements ordered model fallback:
 *   1. Try each model in AI_MODELS list in order
 *   2. On failure (error, empty content, timeout) move to next model
 *   3. If every listed model fails, attempt openrouter/auto as final fallback
 *   4. If that also fails, throw AiUnavailableError
 *
 * No business logic (auth, rate limits, caching) lives here.
 */

import { createHash } from 'crypto';

// ─── Typed error classes ───────────────────────────────────────────

export class AiUnavailableError extends Error {
  constructor(message = 'AI service unavailable after all fallback attempts') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export class AiTimeoutError extends Error {
  constructor(model) {
    super(`AI request timed out for model: ${model}`);
    this.name = 'AiTimeoutError';
    this.model = model;
  }
}

export class AiInvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiInvalidInputError';
  }
}

// ─── Model list ────────────────────────────────────────────────────
//
// Models are tried in order. Swap or extend freely.
// Set AI_MODELS env var as a comma-separated list to override at runtime.
// The final fallback (openrouter/auto) is always appended automatically.

const DEFAULT_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',   // Primary — fast, free tier
  'mistralai/mistral-7b-instruct:free',        // Backup 1
  'google/gemma-2-9b-it:free',                // Backup 2
];

export const AI_MODELS = process.env.AI_MODELS
  ? process.env.AI_MODELS.split(',').map(m => m.trim()).filter(Boolean)
  : DEFAULT_MODELS;

const FALLBACK_MODEL = 'openrouter/auto';

// ─── Config ────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Per-model request timeout in milliseconds
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 25_000;

// Maximum characters accepted in a single AI request
export const MAX_TEXT_LENGTH = 10_000;

// Valid actions
export const VALID_ACTIONS = ['summarize', 'grammar', 'tone', 'translate'];

// ─── Prompt builders ───────────────────────────────────────────────

/**
 * Returns { system, user } message pair for a given action.
 *
 * @param {string} action
 * @param {string} text
 * @param {object} [options]
 * @returns {{ system: string, user: string }}
 */
function buildPrompt(action, text, options = {}) {
  switch (action) {
    case 'summarize':
      return {
        system:
          'You are a concise document summarizer. ' +
          'Return only the summary — no preamble, no labels, no markdown headers. ' +
          'Use 3 to 5 bullet points (•) unless the text is very short.',
        user: `Summarize the following document text:\n\n${text}`,
      };

    case 'grammar':
      return {
        system:
          'You are a professional grammar and spelling corrector. ' +
          'Fix all grammar, spelling, and punctuation errors. ' +
          'Preserve the original meaning, tone, and structure exactly. ' +
          'Return ONLY the corrected text — no explanations, no labels, no diff markers.',
        user: `Correct grammar and spelling errors in the following text:\n\n${text}`,
      };

    case 'tone': {
      const tone = options.tone || 'formal';
      const validTones = ['formal', 'casual', 'persuasive', 'empathetic', 'professional', 'friendly'];
      if (!validTones.includes(tone)) {
        throw new AiInvalidInputError(
          `Invalid tone "${tone}". Valid options: ${validTones.join(', ')}`
        );
      }
      return {
        system:
          `You are a writing tone transformer. ` +
          `Rewrite text to sound ${tone}. ` +
          `Preserve all original facts and structure. ` +
          `Return ONLY the rewritten text — no explanations, no labels.`,
        user: `Rewrite the following text in a ${tone} tone:\n\n${text}`,
      };
    }

    case 'translate': {
      const targetLanguage = options.targetLanguage;
      if (!targetLanguage || typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
        throw new AiInvalidInputError('targetLanguage is required for the translate action.');
      }
      return {
        system:
          'You are a professional translator. ' +
          'Translate text accurately while preserving formatting, tone, and meaning. ' +
          'Return ONLY the translated text — no labels, no explanations.',
        user: `Translate the following text to ${targetLanguage.trim()}:\n\n${text}`,
      };
    }

    default:
      throw new AiInvalidInputError(`Unknown action: ${action}`);
  }
}

// ─── Single model attempt ──────────────────────────────────────────

/**
 * Attempt one model. Resolves with the raw response data, or throws on failure.
 *
 * @param {string} model
 * @param {{ system: string, user: string }} prompt
 * @returns {Promise<{ content: string, tokensUsed: number|null }>}
 */
async function attemptModel(model, prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AiUnavailableError('OPENROUTER_API_KEY is not configured.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(OPENROUTER_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://docsy-client.vercel.app',
        'X-Title': 'Docsy',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user',   content: prompt.user   },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new AiTimeoutError(model);
    }
    throw err;
  }
  clearTimeout(timer);

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Model ${model} returned HTTP ${response.status}: ${errText.slice(0, 120)}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Model ${model} returned non-JSON response.`);
  }

  // Validate content exists and is non-empty
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new Error(`Model ${model} returned empty or missing content.`);
  }

  const tokensUsed = data?.usage?.total_tokens ?? null;

  return { content: content.trim(), tokensUsed };
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Process an AI action with full model fallback.
 *
 * @param {string} action  - 'summarize' | 'grammar' | 'tone' | 'translate'
 * @param {string} text    - The document text to process
 * @param {object} options - Action-specific options (tone, targetLanguage)
 * @returns {Promise<{ result: string, modelUsed: string, tokensUsed: number|null }>}
 * @throws {AiInvalidInputError} on bad input (rethrown up to controller for 400)
 * @throws {AiUnavailableError}  when all models fail (controller → 503)
 */
export async function processAiAction(action, text, options = {}) {
  // Input validation (throws AiInvalidInputError — controller catches for 400)
  if (!VALID_ACTIONS.includes(action)) {
    throw new AiInvalidInputError(`Invalid action "${action}". Valid: ${VALID_ACTIONS.join(', ')}`);
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiInvalidInputError('text is required and must be a non-empty string.');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new AiInvalidInputError(`text exceeds the maximum allowed length of ${MAX_TEXT_LENGTH} characters.`);
  }

  // Build prompts (may also throw AiInvalidInputError for missing options)
  const prompt = buildPrompt(action, text.trim(), options);

  // Build the complete model list: configured list + auto fallback
  const modelsToTry = [...AI_MODELS, FALLBACK_MODEL];

  for (const model of modelsToTry) {
    console.log(`[AiService] Attempting model: ${model} for action: ${action}`);
    try {
      const { content, tokensUsed } = await attemptModel(model, prompt);
      console.log(`[AiService] ✓ Success with model: ${model} | tokens: ${tokensUsed ?? 'n/a'}`);
      return { result: content, modelUsed: model, tokensUsed };
    } catch (err) {
      if (err instanceof AiInvalidInputError) {
        // Input errors must bubble up — no point retrying other models
        throw err;
      }
      console.warn(`[AiService] ✗ Model ${model} failed: ${err.message}`);
      // Continue to next model
    }
  }

  // Every model (including openrouter/auto) failed
  throw new AiUnavailableError(
    `All models failed for action "${action}". Check OpenRouter API key and model availability.`
  );
}

// ─── Cache key helper (exported for use in controller) ─────────────

/**
 * Generate a deterministic SHA-256 cache key from action + text + options.
 *
 * @param {string} action
 * @param {string} text
 * @param {object} options
 * @returns {string}
 */
export function buildCacheKey(action, text, options = {}) {
  const payload = `${action}|${text}|${JSON.stringify(options)}`;
  return `ai:cache:${createHash('sha256').update(payload).digest('hex')}`;
}

// ─── Cache TTLs per action (seconds) ──────────────────────────────

export const CACHE_TTLS = {
  summarize: 3_600,      // 1 hour
  grammar:   1_800,      // 30 minutes
  tone:      1_800,      // 30 minutes
  translate: 86_400,     // 24 hours
};
