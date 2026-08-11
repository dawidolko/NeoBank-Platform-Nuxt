import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRateLimits, clearRateLimit, enforceRateLimit } from '../server/utils/rateLimit'

/**
 * The limiter reads the client IP and writes a response header through h3's
 * request helpers, which are Nitro auto-imports at runtime. Stubbing them keeps
 * these tests free of a live server.
 */
const headers = new Map<string, unknown>()

vi.stubGlobal('getRequestIP', () => '203.0.113.7')
vi.stubGlobal('setResponseHeader', (_event: unknown, name: string, value: unknown) => {
  headers.set(name, value)
})
vi.stubGlobal('createError', (init: { statusCode: number; statusMessage: string; data?: unknown }) =>
  Object.assign(new Error(init.statusMessage), init),
)

const event = {} as never

describe('enforceRateLimit', () => {
  beforeEach(() => {
    __resetRateLimits()
    headers.clear()
  })

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(() => enforceRateLimit(event, { key: 'k', limit: 5, windowMs: 60_000 })).not.toThrow()
    }
  })

  it('throws 429 once the limit is exceeded', () => {
    for (let i = 0; i < 5; i += 1) {
      enforceRateLimit(event, { key: 'k', limit: 5, windowMs: 60_000 })
    }

    expect(() => enforceRateLimit(event, { key: 'k', limit: 5, windowMs: 60_000 })).toThrow(
      /too many requests/i,
    )
  })

  it('sets a retry-after header describing the wait', () => {
    enforceRateLimit(event, { key: 'k', limit: 1, windowMs: 30_000 })

    expect(() => enforceRateLimit(event, { key: 'k', limit: 1, windowMs: 30_000 })).toThrow()
    expect(headers.get('retry-after')).toBeGreaterThan(0)
    expect(headers.get('retry-after')).toBeLessThanOrEqual(30)
  })

  it('keeps buckets separate per key', () => {
    enforceRateLimit(event, { key: 'a', limit: 1, windowMs: 60_000 })

    expect(() => enforceRateLimit(event, { key: 'b', limit: 1, windowMs: 60_000 })).not.toThrow()
  })

  it('keeps buckets separate per identifier, so one account cannot lock out another', () => {
    enforceRateLimit(event, { key: 'login', limit: 1, windowMs: 60_000, identifier: 'a@x.com' })

    expect(() =>
      enforceRateLimit(event, { key: 'login', limit: 1, windowMs: 60_000, identifier: 'b@x.com' }),
    ).not.toThrow()
  })

  it('starts a fresh window once the old one expires', () => {
    vi.useFakeTimers()

    try {
      enforceRateLimit(event, { key: 'k', limit: 1, windowMs: 1_000 })
      expect(() => enforceRateLimit(event, { key: 'k', limit: 1, windowMs: 1_000 })).toThrow()

      vi.advanceTimersByTime(1_500)

      expect(() => enforceRateLimit(event, { key: 'k', limit: 1, windowMs: 1_000 })).not.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clearRateLimit resets the bucket after a successful attempt', () => {
    enforceRateLimit(event, { key: 'login', limit: 1, windowMs: 60_000, identifier: 'a@x.com' })
    clearRateLimit(event, 'login', 'a@x.com')

    expect(() =>
      enforceRateLimit(event, { key: 'login', limit: 1, windowMs: 60_000, identifier: 'a@x.com' }),
    ).not.toThrow()
  })
})
