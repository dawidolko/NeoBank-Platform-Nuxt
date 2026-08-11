// Imported explicitly rather than relying on Nitro's auto-import: this module
// is also loaded directly by the Vitest suites, which run outside Nitro.
import { createError, getRequestIP, setResponseHeader, type H3Event } from 'h3'

interface Bucket {
  count: number
  resetAt: number
}

/**
 * Fixed-window rate limiter held in process memory.
 *
 * Sufficient for a single-instance deployment. Behind multiple replicas each
 * process keeps its own window, so a shared store (Redis) would be needed to
 * make the limit global.
 */
const buckets = new Map<string, Bucket>()

let lastSweep = 0
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return

  lastSweep = now

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  /** Bucket namespace, e.g. 'login'. */
  key: string
  limit: number
  windowMs: number
  /** Extra discriminator beyond the client IP, e.g. the submitted email. */
  identifier?: string
}

/**
 * Consume one token, or throw 429. Call before any expensive work so the limit
 * actually protects the endpoint.
 */
export function enforceRateLimit(event: H3Event, options: RateLimitOptions): void {
  const now = Date.now()

  sweep(now)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const bucketKey = `${options.key}:${ip}:${options.identifier ?? ''}`
  const existing = buckets.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs })
    return
  }

  existing.count += 1

  if (existing.count > options.limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000)

    setResponseHeader(event, 'retry-after', retryAfter)

    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: {
        errors: {
          form: `Too many attempts. Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} and try again.`,
        },
      },
    })
  }
}

/** Drop a bucket after a successful attempt so honest users are not penalized. */
export function clearRateLimit(event: H3Event, key: string, identifier?: string): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

  buckets.delete(`${key}:${ip}:${identifier ?? ''}`)
}

/** Test seam — the limiter is module-level state shared across requests. */
export function __resetRateLimits(): void {
  buckets.clear()
  lastSweep = 0
}
