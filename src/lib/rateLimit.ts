// Simple in-memory rate limiter for Node.js serverless functions.
// State persists within a warm Lambda instance but resets on cold start.
// Good enough to prevent casual abuse of paid API routes.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/**
 * Returns true if the request is allowed, false if it should be rate-limited.
 * @param key      Unique identifier (e.g. IP + route)
 * @param max      Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || now > existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= max) return false;
  existing.count++;
  return true;
}
