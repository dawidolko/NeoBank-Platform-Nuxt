/**
 * Money helpers.
 *
 * Every amount in the system is a BigInt count of minor units (grosze, cents).
 * Floats never touch a balance — they only appear at the presentation edge.
 */

export const CURRENCY_MINOR_UNITS = {
  PLN: 2,
  EUR: 2,
  USD: 2,
  GBP: 2,
} as const

export type CurrencyCode = keyof typeof CURRENCY_MINOR_UNITS

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  PLN: 'zł',
  EUR: '€',
  USD: '$',
  GBP: '£',
}

/**
 * Parse a human-entered amount ("1234.56", "1 234,56") into minor units.
 * Throws on anything that isn't a clean, non-negative, correctly-scaled number.
 */
export function parseAmountToCents(input: string | number, currency: CurrencyCode = 'PLN'): bigint {
  const scale = CURRENCY_MINOR_UNITS[currency]
  const raw = String(input).trim().replace(/\s/g, '').replace(',', '.')

  if (raw === '') throw new Error('Amount is required')
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error('Amount must be a positive number')

  const [whole = '0', fraction = ''] = raw.split('.')

  if (fraction.length > scale) {
    throw new Error(`Amount supports at most ${scale} decimal places`)
  }

  const padded = fraction.padEnd(scale, '0')
  const cents = BigInt(whole) * BigInt(10 ** scale) + BigInt(padded || '0')

  if (cents <= 0n) throw new Error('Amount must be greater than zero')

  return cents
}

/** Render minor units as a plain decimal string ("123456" -> "1234.56"). */
export function centsToDecimalString(cents: bigint, currency: CurrencyCode = 'PLN'): string {
  const scale = CURRENCY_MINOR_UNITS[currency]
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const divisor = BigInt(10 ** scale)
  const whole = absolute / divisor
  const fraction = (absolute % divisor).toString().padStart(scale, '0')

  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/**
 * Would this debit push the account past its overdraft limit?
 * Balance and overdraft are both minor units; overdraft is a positive allowance.
 */
export function hasSufficientFunds(
  balanceCents: bigint,
  overdraftCents: bigint,
  debitCents: bigint,
): boolean {
  return balanceCents - debitCents >= -overdraftCents
}
