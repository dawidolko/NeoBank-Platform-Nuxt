import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, transferSchema } from '../server/utils/validation'

describe('registerSchema', () => {
  const valid = {
    email: 'Test.User@Example.COM',
    password: 'StrongPass1',
    firstName: '  Anna ',
    lastName: 'Kowalska',
  }

  it('normalizes email casing and trims names', () => {
    const result = registerSchema.parse(valid)

    expect(result.email).toBe('test.user@example.com')
    expect(result.firstName).toBe('Anna')
  })

  it('enforces every password rule', () => {
    const cases: Array<[string, RegExp]> = [
      ['Short1', /at least 10/],
      ['alllowercase1', /uppercase/],
      ['ALLUPPERCASE1', /lowercase/],
      ['NoDigitsHere', /digit/],
    ]

    for (const [password, message] of cases) {
      const result = registerSchema.safeParse({ ...valid, password })

      expect(result.success, password).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(message)
      }
    }
  })

  it('rejects malformed emails', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('treats an empty phone as omitted rather than invalid', () => {
    const result = registerSchema.parse({ ...valid, phone: '' })

    expect(result.phone).toBeUndefined()
  })
})

describe('loginSchema', () => {
  it('does not apply password strength rules to sign-in', () => {
    // Legacy passwords must still be able to authenticate.
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
})

describe('transferSchema', () => {
  const base = {
    sourceAccountId: '3f0f9c1e-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
    destinationIban: 'GB82 WEST 1234 5698 7654 32',
    amount: '120.50',
    title: 'Invoice 04/2026',
  }

  it('normalizes the IBAN to compact uppercase', () => {
    expect(transferSchema.parse(base).destinationIban).toBe('GB82WEST12345698765432')
  })

  it('rejects an IBAN that fails the checksum', () => {
    expect(transferSchema.safeParse({ ...base, destinationIban: 'GB83WEST12345698765432' }).success).toBe(false)
  })

  it('accepts both comma and dot decimals', () => {
    expect(transferSchema.safeParse({ ...base, amount: '120,50' }).success).toBe(true)
  })

  it('rejects negative, zero-decimal-overflow and non-numeric amounts', () => {
    for (const amount of ['-10', '10.999', 'abc', '']) {
      expect(transferSchema.safeParse({ ...base, amount }).success, amount).toBe(false)
    }
  })

  it('requires a meaningful title', () => {
    expect(transferSchema.safeParse({ ...base, title: 'ab' }).success).toBe(false)
  })

  it('rejects a non-uuid source account', () => {
    expect(transferSchema.safeParse({ ...base, sourceAccountId: '123' }).success).toBe(false)
  })
})
