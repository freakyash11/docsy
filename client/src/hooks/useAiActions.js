/**
 * useAiActions.js
 *
 * Custom React hook encapsulating all AI fetch logic.
 * Keeps TextEditor.js and AiPanel.js free of raw fetch boilerplate.
 *
 * Usage:
 *   const { isLoading, error, result, modelUsed, run, reset } = useAiActions();
 *
 *   await run('grammar', selectedText);
 *   await run('tone',    selectedText, { tone: 'formal' });
 *   await run('translate', text,       { targetLanguage: 'French' });
 *   await run('summarize', fullText);
 */

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Client-side timeout (slightly longer than server-side 25s to let the server
// return its own timeout error rather than a generic network abort)
const CLIENT_TIMEOUT_MS = 32_000;

export function useAiActions() {
  // isSignedIn is used to short-circuit before any network request for guests.
  // The backend (authMiddleware) is a secondary safety net, but we must never
  // even attempt the fetch for unauthenticated users — both to avoid wasting
  // AI credits and to give a clear UX message instead of a confusing 401 error.
  const { getToken, isSignedIn } = useAuth();

  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState(null);       // user-facing string or null
  const [result, setResult]         = useState(null);       // AI output string or null
  const [modelUsed, setModelUsed]   = useState(null);       // model name string or null
  const [isCached, setIsCached]     = useState(false);
  const [retryAfter, setRetryAfter] = useState(null);       // seconds, for 429 UI

  const abortRef = useRef(null);

  /**
   * Reset all state (call before opening the panel or switching actions).
   */
  const reset = useCallback(() => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
    setError(null);
    setResult(null);
    setModelUsed(null);
    setIsCached(false);
    setRetryAfter(null);
  }, []);

  /**
   * Run an AI action.
   *
   * @param {string} action         - 'summarize' | 'grammar' | 'tone' | 'translate'
   * @param {string} text           - The text to process
   * @param {object} [options]      - { tone?, targetLanguage? }
   */
  const run = useCallback(async (action, text, options = {}) => {
    // ── Guest gate ────────────────────────────────────────────────────
    // Reject immediately without any network request. The UI should already
    // prevent guests from reaching this code path, but this is a hard
    // client-side safety net in case the panel is opened programmatically.
    if (!isSignedIn) {
      setError('Sign in to use AI tools.');
      return;
    }
    // ─────────────────────────────────────────────────────────────────

    // Cancel any previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setModelUsed(null);
    setIsCached(false);
    setRetryAfter(null);

    // Client-side timeout
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const token = await getToken();

      const response = await fetch(`${BACKEND_URL}/api/ai/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text, options }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Map server error codes to friendly messages.
        // NOTE: Viewer users are legitimate callers of AI generation — only the
        // *apply* step is restricted. A 401 here means auth token failure, not
        // a viewer-permission issue.
        switch (data.error) {
          case 'RATE_LIMIT_EXCEEDED':
            setRetryAfter(data.retryAfter ?? 60);
            setError(`You've hit your AI limit. Try again in ${data.retryAfter ?? 60}s.`);
            break;
          case 'TEXT_TOO_LONG':
            setError('The selected text is too long. Please select a shorter passage.');
            break;
          case 'AI_TIMEOUT':
            setError('The AI took too long to respond. Please try again.');
            break;
          case 'AI_UNAVAILABLE':
            setError('AI is temporarily unavailable. Please try again later.');
            break;
          case 'MISSING_OPTION':
            setError(data.message || 'A required option is missing.');
            break;
          case 'UNAUTHORIZED':
            // Auth token failure — surface a clear message rather than the generic fallback
            setError('You need to be signed in to use AI features.');
            break;
          default:
            // For HTTP 401 responses that don't carry a typed error code
            if (response.status === 401) {
              setError('You need to be signed in to use AI features.');
            } else {
              setError(data.message || 'Something went wrong. Please try again.');
            }
        }
        return;
      }

      setResult(data.result);
      setModelUsed(data.modelUsed);
      setIsCached(data.cached ?? false);

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        // Only show timeout message if the user didn't explicitly reset
        if (!controller.signal.aborted || abortRef.current === controller) {
          setError('The request timed out. Please try again.');
        }
      } else {
        console.error('[useAiActions] Fetch error:', err);
        setError('A network error occurred. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [getToken, isSignedIn]);

  return {
    isLoading,
    error,
    result,
    modelUsed,
    isCached,
    retryAfter,
    run,
    reset,
  };
}
