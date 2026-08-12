/**
 * Regression tests for counterparty resolution.
 *
 * Three screens previously each had their own version of this logic and showed
 * a different name for the same transfer. Worse, the dashboard endpoint did not
 * select the account relations at all, so every internal transfer between two
 * customers rendered as "Transfer to your account" — factually wrong.
 *
 * These cases pin the shapes each endpoint actually returns.
 */
import { describe, expect, it } from 'vitest'
import { useCounterparty } from '../app/composables/useCounterparty'

const { forEntry, forSide } = useCounterparty()

describe('forEntry', () => {
  it('prefers the recorded external name for outbound payments', () => {
    expect(
      forEntry({ type: 'EXTERNAL', externalName: 'Property Management Ltd' }, 'DEBIT'),
    ).toBe('Property Management Ltd')
  })

  it('names the other customer on an internal credit', () => {
    expect(
      forEntry(
        {
          type: 'INTERNAL',
          sourceAccount: { user: { firstName: 'Piotr', lastName: 'Zieliński' } },
        },
        'CREDIT',
      ),
    ).toBe('Piotr Zieliński')
  })

  it('names the other customer on an internal debit', () => {
    expect(
      forEntry(
        {
          type: 'INTERNAL',
          destinationAccount: { user: { firstName: 'Marta', lastName: 'Lewandowska' } },
        },
        'DEBIT',
      ),
    ).toBe('Marta Lewandowska')
  })

  it('falls back to the account name when the relation carries no user', () => {
    expect(
      forEntry({ type: 'INTERNAL', destinationAccount: { name: 'Savings Goal' } }, 'DEBIT'),
    ).toBe('Savings Goal')
  })

  it('labels a deposit as an incoming payment', () => {
    expect(forEntry({ type: 'DEPOSIT' }, 'CREDIT')).toBe('Incoming payment')
  })

  it('only claims "your account" when there is genuinely no counterparty', () => {
    // This is the string that used to leak onto every dashboard row.
    expect(forEntry({ type: 'INTERNAL' }, 'DEBIT')).toBe('Transfer to your account')
    expect(forEntry({ type: 'INTERNAL' }, 'CREDIT')).toBe('Transfer from your account')
  })

  it('never returns an empty label for any transfer type', () => {
    for (const type of ['INTERNAL', 'EXTERNAL', 'DEPOSIT', 'WITHDRAWAL']) {
      for (const direction of ['DEBIT', 'CREDIT'] as const) {
        expect(forEntry({ type }, direction).length, `${type}/${direction}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('forSide', () => {
  it('names the account holder when the relation is present', () => {
    expect(forSide({ user: { firstName: 'Anna', lastName: 'Kowalska' } })).toBe('Anna Kowalska')
  })

  it('falls back to the external name, then to a masked IBAN', () => {
    expect(forSide(null, 'Jan Nowak')).toBe('Jan Nowak')
    expect(forSide(null, null, 'PL61109010140000071219812874')).toBe('•••• 2874')
  })

  it('returns a dash when nothing identifies the side', () => {
    expect(forSide(null)).toBe('—')
  })
})
