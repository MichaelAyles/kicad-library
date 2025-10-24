/**
 * Admin API Authentication
 *
 * Verifies admin API key for batch import operations
 */

/**
 * Verify admin API key from request headers
 *
 * @param authHeader - Authorization header value (Bearer token)
 * @returns true if valid admin key, false otherwise
 */
export function verifyAdminKey(authHeader: string | null): boolean {
  if (!authHeader) {
    return false;
  }

  // Extract Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }

  const providedKey = match[1];
  const adminKey = process.env.ADMIN_API_KEY;

  // Check if admin key is configured
  if (!adminKey) {
    console.error('ADMIN_API_KEY not configured in environment variables');
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(providedKey, adminKey);
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by ensuring comparison always takes same time
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate a secure random API key
 * Use this once to generate the ADMIN_API_KEY for .env.local
 *
 * Example usage:
 * ```
 * const key = generateAdminKey();
 * console.log('Add to .env.local:', key);
 * ```
 */
export function generateAdminKey(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('base64url');
}
