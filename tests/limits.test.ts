/**
 * Guards the money ceilings and the profile/export schemas.
 *
 * Self-service deposits mean a customer can credit their own account, so the
 * cap is the only thing standing between the demo and an unbounded balance.
 */
import { describe, expect, it } from 'vitest'
import { MAX_DEPOSIT_CENTS, MAX_TRANSFER_CENTS } from '../server/services/transfers'
import {
  accountRenameSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  statementExportSchema,
  adminTransferQuerySchema,
} from '../server/utils/validation'

describe('money ceilings', () => {
  it('caps a single transfer and a single deposit at 1 000 000.00', () => {
    expect(MAX_TRANSFER_CENTS).toBe(100_000_000n)
    expect(MAX_DEPOSIT_CENTS).toBe(100_000_000n)
  })

  it('keeps the caps within a value BigInt can represent exactly', () => {
    expect(MAX_DEPOSIT_CENTS > 0n).toBe(true)
    expect(Number(MAX_DEPOSIT_CENTS)).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })
})

describe('profileUpdateSchema', () => {
  it('trims names and treats an empty phone as omitted', () => {
    const result = profileUpdateSchema.parse({
      firstName: '  Anna ',
      lastName: 'Kowalska',
      phone: '',
    })

    expect(result.firstName).toBe('Anna')
    expect(result.phone).toBeUndefined()
  })

  it('rejects names that are too short', () => {
    expect(
      profileUpdateSchema.safeParse({ firstName: 'A', lastName: 'Kowalska' }).success,
    ).toBe(false)
  })
})

describe('passwordChangeSchema', () => {
  const valid = {
    currentPassword: 'OldPassword1',
    newPassword: 'BrandNewPass1',
    confirmPassword: 'BrandNewPass1',
  }

  it('accepts a matching, strong new password', () => {
    expect(passwordChangeSchema.safeParse(valid).success).toBe(true)
  })

  it('reports a mismatch against the confirm field, not the new password', () => {
    const result = passwordChangeSchema.safeParse({ ...valid, confirmPassword: 'Different1' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  it('applies the full strength policy to the new password', () => {
    for (const weak of ['short1A', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsAtAll']) {
      expect(
        passwordChangeSchema.safeParse({
          ...valid,
          newPassword: weak,
          confirmPassword: weak,
        }).success,
        weak,
      ).toBe(false)
    }
  })
})

describe('statementExportSchema', () => {
  it('accepts an empty query — exporting everything is valid', () => {
    expect(statementExportSchema.parse({})).toEqual({})
  })

  it('rejects a malformed date', () => {
    expect(statementExportSchema.safeParse({ from: '11-08-2026' }).success).toBe(false)
  })

  it('rejects a non-uuid account filter', () => {
    expect(statementExportSchema.safeParse({ accountId: 'all' }).success).toBe(false)
  })
})

describe('adminTransferQuerySchema', () => {
  it('rejects a status outside the enum instead of passing it to the database', () => {
    expect(adminTransferQuerySchema.safeParse({ status: 'BOGUS' }).success).toBe(false)
  })

  it('applies defaults and clamps perPage', () => {
    expect(adminTransferQuerySchema.parse({})).toMatchObject({ page: 1, perPage: 25 })
    expect(adminTransferQuerySchema.safeParse({ perPage: 5000 }).success).toBe(false)
  })
})

describe('accountRenameSchema', () => {
  it('trims and enforces a sensible length', () => {
    expect(accountRenameSchema.parse({ name: '  Holiday fund ' }).name).toBe('Holiday fund')
    expect(accountRenameSchema.safeParse({ name: 'x' }).success).toBe(false)
    expect(accountRenameSchema.safeParse({ name: 'y'.repeat(61) }).success).toBe(false)
  })
})
