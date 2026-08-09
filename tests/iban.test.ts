import { describe, expect, it } from 'vitest'
import { formatIban, generateIban, isValidIban, normalizeIban } from '../server/utils/iban'

describe('isValidIban', () => {
  it('accepts real-world IBANs across supported countries', () => {
    const valid = [
      'GB82WEST12345698765432',
      'DE89370400440532013000',
      'PL61109010140000071219812874',
      'NL91ABNA0417164300',
      'FR1420041010050500013M02606',
      'ES9121000418450200051332',
    ]

    for (const iban of valid) {
      expect(isValidIban(iban), iban).toBe(true)
    }
  })

  it('accepts IBANs with human spacing', () => {
    expect(isValidIban('GB82 WEST 1234 5698 7654 32')).toBe(true)
  })

  it('rejects a tampered check digit', () => {
    expect(isValidIban('GB83WEST12345698765432')).toBe(false)
  })

  it('rejects a transposed body — the case a length check alone would miss', () => {
    expect(isValidIban('DE89370400440532013100')).toBe(false)
  })

  it('rejects unknown country codes', () => {
    expect(isValidIban('XX82WEST12345698765432')).toBe(false)
  })

  it('rejects wrong length for a known country', () => {
    expect(isValidIban('PL6110901014000007121981')).toBe(false)
  })

  it('rejects malformed and empty input', () => {
    expect(isValidIban('')).toBe(false)
    expect(isValidIban('not-an-iban')).toBe(false)
    expect(isValidIban('1234567890')).toBe(false)
  })
})

describe('generateIban', () => {
  it('produces checksum-valid Polish IBANs', () => {
    for (let i = 0; i < 500; i += 1) {
      const iban = generateIban()

      expect(iban).toHaveLength(28)
      expect(iban.startsWith('PL')).toBe(true)
      expect(isValidIban(iban), iban).toBe(true)
    }
  })

  it('is deterministic when given a suffix, so seeds are reproducible', () => {
    expect(generateIban('customer-1')).toBe(generateIban('customer-1'))
    expect(generateIban('customer-1')).not.toBe(generateIban('customer-2'))
  })
})

describe('formatting helpers', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalizeIban(' pl61 1090 1014 ')).toBe('PL6110901014')
  })

  it('groups into four-character blocks', () => {
    expect(formatIban('GB82WEST12345698765432')).toBe('GB82 WEST 1234 5698 7654 32')
  })
})
