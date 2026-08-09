import { describe, expect, it } from 'vitest'
import {
  centsToDecimalString,
  hasSufficientFunds,
  parseAmountToCents,
} from '../server/utils/money'

describe('parseAmountToCents', () => {
  it('parses whole and fractional amounts', () => {
    expect(parseAmountToCents('120')).toBe(12_000n)
    expect(parseAmountToCents('120.5')).toBe(12_050n)
    expect(parseAmountToCents('120.55')).toBe(12_055n)
    expect(parseAmountToCents('0.01')).toBe(1n)
  })

  it('accepts comma decimals and spaces as typed by users', () => {
    expect(parseAmountToCents('1 234,56')).toBe(123_456n)
    expect(parseAmountToCents('1234,5')).toBe(123_450n)
  })

  it('handles amounts far beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    // 99 999 999 999 999.99 — would lose cents as a float.
    expect(parseAmountToCents('99999999999999.99')).toBe(9_999_999_999_999_999n)
  })

  it('rejects zero and negative amounts', () => {
    expect(() => parseAmountToCents('0')).toThrow(/greater than zero/)
    expect(() => parseAmountToCents('0.00')).toThrow(/greater than zero/)
    expect(() => parseAmountToCents('-5')).toThrow(/positive number/)
  })

  it('rejects more decimal places than the currency supports', () => {
    expect(() => parseAmountToCents('10.999')).toThrow(/at most 2 decimal places/)
  })

  it('rejects non-numeric input', () => {
    expect(() => parseAmountToCents('abc')).toThrow(/positive number/)
    expect(() => parseAmountToCents('')).toThrow(/required/)
    expect(() => parseAmountToCents('1e5')).toThrow(/positive number/)
  })
})

describe('centsToDecimalString', () => {
  it('always renders both minor digits', () => {
    expect(centsToDecimalString(12_050n)).toBe('120.50')
    expect(centsToDecimalString(5n)).toBe('0.05')
    expect(centsToDecimalString(0n)).toBe('0.00')
  })

  it('keeps the sign on negative balances', () => {
    expect(centsToDecimalString(-12_050n)).toBe('-120.50')
  })

  it('round-trips with parseAmountToCents', () => {
    for (const value of ['1.00', '0.01', '9999.99', '123456.78']) {
      expect(centsToDecimalString(parseAmountToCents(value))).toBe(value)
    }
  })
})

describe('hasSufficientFunds', () => {
  it('allows a debit that lands exactly on zero', () => {
    expect(hasSufficientFunds(10_000n, 0n, 10_000n)).toBe(true)
  })

  it('blocks a debit one cent beyond the balance', () => {
    expect(hasSufficientFunds(10_000n, 0n, 10_001n)).toBe(false)
  })

  it('permits going negative within the overdraft', () => {
    expect(hasSufficientFunds(0n, 50_000n, 50_000n)).toBe(true)
    expect(hasSufficientFunds(0n, 50_000n, 50_001n)).toBe(false)
  })

  it('treats an already-negative balance correctly', () => {
    expect(hasSufficientFunds(-10_000n, 50_000n, 40_000n)).toBe(true)
    expect(hasSufficientFunds(-10_000n, 50_000n, 40_001n)).toBe(false)
  })
})
