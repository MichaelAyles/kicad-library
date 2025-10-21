/**
 * Simple in-memory rate limiter
 *
 * IMPORTANT: This is a basic implementation for MVP.
 * For production with multiple serverless instances, use:
 * - Upstash Redis (@upstash/ratelimit)
 * - Vercel KV
 * - Or another distributed rate limiting solution
 *
 * This implementation will only work within a single serverless instance.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (NOTE: resets on each cold start in serverless)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupExpiredEntries(now);
  }

  const entry = rateLimitStore.get(identifier);

  // No entry or expired entry
  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  // Increment counter
  entry.count++;

  // Check if over limit
  if (entry.count > config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Clean up expired rate limit entries to prevent memory growth
 */
function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
  /** Strict: 10 requests per 10 seconds */
  STRICT: { maxRequests: 10, windowSeconds: 10 },

  /** Moderate: 30 requests per minute */
  MODERATE: { maxRequests: 30, windowSeconds: 60 },

  /** Lenient: 100 requests per minute */
  LENIENT: { maxRequests: 100, windowSeconds: 60 },

  /** API: 1000 requests per hour */
  API: { maxRequests: 1000, windowSeconds: 3600 },
} as const;
