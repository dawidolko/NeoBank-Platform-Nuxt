/**
 * `serializeBigInt` sits on the response path of every endpoint that returns
 * money. A regression here is a 500 on half the API, so the traversal rules are
 * pinned explicitly.
 */
import { describe, expect, it } from 'vitest'
import { serializeBigInt } from '../server/utils/serialize'

describe('serializeBigInt', () => {
  it('converts a bare BigInt to a string', () => {
    expect(serializeBigInt(12_050n)).toBe('12050')
  })

  it('preserves exactness beyond Number.MAX_SAFE_INTEGER', () => {
    const huge = 9_007_199_254_740_993n // MAX_SAFE_INTEGER + 2

    expect(serializeBigInt(huge)).toBe('9007199254740993')
  })

  it('keeps negative amounts signed', () => {
    expect(serializeBigInt(-1n)).toBe('-1')
  })

  it('walks nested objects and arrays', () => {
    const input = {
      account: { balanceCents: 100n, name: 'Everyday' },
      entries: [{ amountCents: -50n }, { amountCents: 50n }],
    }

    expect(serializeBigInt(input)).toEqual({
      account: { balanceCents: '100', name: 'Everyday' },
      entries: [{ amountCents: '-50' }, { amountCents: '50' }],
    })
  })

  it('leaves Dates intact so the client can parse them', () => {
    const date = new Date('2026-08-12T10:00:00.000Z')

    expect(serializeBigInt({ bookedAt: date }).bookedAt).toBeInstanceOf(Date)
  })

  it('passes through null, undefined and primitives untouched', () => {
    expect(serializeBigInt(null)).toBeNull()
    expect(serializeBigInt(undefined)).toBeUndefined()
    expect(serializeBigInt('PLN')).toBe('PLN')
    expect(serializeBigInt(42)).toBe(42)
    expect(serializeBigInt(true)).toBe(true)
  })

  it('produces output that survives JSON.stringify', () => {
    const payload = serializeBigInt({ totals: { depositsCents: 6_796_232n } })

    expect(() => JSON.stringify(payload)).not.toThrow()
    expect(JSON.parse(JSON.stringify(payload)).totals.depositsCents).toBe('6796232')
  })

  it('round-trips back to the same BigInt', () => {
    const original = 4_281_372n

    expect(BigInt(serializeBigInt(original) as unknown as string)).toBe(original)
  })
})
