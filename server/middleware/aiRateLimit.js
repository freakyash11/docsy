/**
 * aiRateLimit.js
 *
 * Redis sliding-window rate limiter for AI endpoints.
 *
 * Strategy:
 *   - Keyed per authenticated Clerk user ID (req.userId set by authMiddleware)
 *   - 60-second rolling window
 *   - Default limit: 10 requests / minute (overridable via AI_RATE_LIMIT_MAX env var)
 *   - Returns 429 with retryAfter (seconds) when limit is exceeded
 *   - No extra packages needed — uses the ioredis client already in the app
 *
 * Future tier support:
 *   - Add aiTier to the User model ('free' | 'pro' | 'team')
 *   - Look up tier here and set limit = TIER_LIMITS[tier]
 *   - Zero changes to routes or controller needed
 */

const WINDOW_SECONDS = 60;
const DEFAULT_MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_MAX) || 10;

/**
 * Build the Redis key for a given user's AI rate limit counter.
 * @param {string} userId - Clerk user ID from req.userId
 * @returns {string}
 */
const rateLimitKey = (userId) => `ratelimit:ai:${userId}`;

/**
 * Express middleware.
 * Requires authMiddleware to have already run (req.userId must be set).
 * Requires the Express app to have a Redis client stored via app.set('redis', client).
 */
const aiRateLimit = async (req, res, next) => {
  const userId = req.userId;

  // Should never reach here without auth, but guard defensively
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required for AI features.',
    });
  }

  // Retrieve the Redis client injected into the app in server.js
  const redis = req.app.get('redis');
  if (!redis) {
    // If Redis is unavailable, fail open so AI still works (log the issue)
    console.error('[aiRateLimit] Redis client not found on app — skipping rate limit');
    return next();
  }

  const key = rateLimitKey(userId);

  try {
    // Atomically increment counter
    const count = await redis.incr(key);

    // On first request in this window, set the expiry
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (count > DEFAULT_MAX_REQUESTS) {
      const retryAfter = await redis.ttl(key);
      console.warn(`[aiRateLimit] Rate limit exceeded for user: ${userId} (count: ${count})`);
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `You have exceeded ${DEFAULT_MAX_REQUESTS} AI requests per minute. Try again shortly.`,
        retryAfter: retryAfter > 0 ? retryAfter : WINDOW_SECONDS,
      });
    }

    // Attach rate limit info to the response headers (informational)
    res.setHeader('X-RateLimit-Limit', DEFAULT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, DEFAULT_MAX_REQUESTS - count));

    next();
  } catch (err) {
    // Redis error — fail open so AI still works
    console.error('[aiRateLimit] Redis error, skipping rate limit:', err.message);
    next();
  }
};

export default aiRateLimit;
