/**
 * Regression tests for serialization-conflict detection.
 *
 * Prisma does not put the SQLSTATE on `error.code` for raw queries — a failed
 * `$queryRaw` surfaces as P2010 with the real `40001` buried in the message.
 * Matching on the code alone silently disabled every retry, so concurrent
 * transfers failed with a raw Prisma error instead of being replayed. These
 * tests pin the shapes that must stay retryable.
 */
import { describe, expect, it } from 'vitest'
import { __testing } from '../server/services/transfers'

const { isRetryableConflict } = __testing

describe('isRetryableConflict', () => {
  it('detects a bare serialization failure SQLSTATE', () => {
    expect(isRetryableConflict({ code: '40001' })).toBe(true)
  })

  it('detects a deadlock SQLSTATE', () => {
    expect(isRetryableConflict({ code: '40P01' })).toBe(true)
  })

  it("detects Prisma's own transaction conflict code", () => {
    expect(isRetryableConflict({ code: 'P2034' })).toBe(true)
  })

  it('detects a raw-query failure carrying 40001 in the message (the bug)', () => {
    // This is the exact shape Prisma throws from tx.$queryRaw under contention.
    const error = {
      code: 'P2010',
      message:
        'Invalid `prisma.$queryRaw()` invocation:\n\nRaw query failed. Code: `40001`. Message: `could not serialize access due to concurrent update`',
    }

    expect(isRetryableConflict(error)).toBe(true)
  })

  it('detects a deadlock reported through a raw query', () => {
    expect(
      isRetryableConflict({
        code: 'P2010',
        message: 'Raw query failed. Code: `40P01`. Message: `deadlock detected`',
      }),
    ).toBe(true)
  })

  it('falls back to the message when no code is present', () => {
    expect(
      isRetryableConflict({ message: 'could not serialize access due to read/write dependencies' }),
    ).toBe(true)
  })

  it('does not retry unrelated database errors', () => {
    expect(isRetryableConflict({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false)
    expect(isRetryableConflict({ code: 'P2025', message: 'Record not found' })).toBe(false)
    expect(isRetryableConflict({ code: '23505', message: 'duplicate key value' })).toBe(false)
  })

  it('does not retry a P2010 that is not a conflict', () => {
    expect(
      isRetryableConflict({ code: 'P2010', message: 'Raw query failed. Code: `42P01`.' }),
    ).toBe(false)
  })

  it('tolerates null, undefined and non-objects', () => {
    expect(isRetryableConflict(null)).toBe(false)
    expect(isRetryableConflict(undefined)).toBe(false)
    expect(isRetryableConflict('boom')).toBe(false)
  })
})
