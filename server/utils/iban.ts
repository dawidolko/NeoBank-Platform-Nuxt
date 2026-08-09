/**
 * IBAN generation and validation (ISO 13616 / mod-97-10 checksum).
 *
 * NeoBank issues Polish-format IBANs: PL + 2 check digits + 24 digits,
 * where the first 8 digits are the (fictional) NeoBank sort code.
 */

const NEOBANK_SORT_CODE = '10203040'
const IBAN_LENGTHS: Record<string, number> = {
  PL: 28,
  DE: 22,
  GB: 22,
  FR: 27,
  ES: 24,
  IT: 27,
  NL: 18,
  CZ: 24,
}

/** mod-97 over an arbitrarily long numeric string, without BigInt overflow concerns. */
function mod97(numeric: string): number {
  let remainder = 0

  for (const char of numeric) {
    remainder = (remainder * 10 + Number(char)) % 97
  }

  return remainder
}

/** Rearrange + letter-to-digit expansion, per ISO 13616. */
function toNumericForm(iban: string): string {
  const rearranged = iban.slice(4) + iban.slice(0, 4)

  return rearranged
    .split('')
    .map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join('')
}

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input)

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false

  const country = iban.slice(0, 2)
  const expectedLength = IBAN_LENGTHS[country]

  // Unknown country codes are rejected rather than guessed at.
  if (expectedLength === undefined || iban.length !== expectedLength) return false

  return mod97(toNumericForm(iban)) === 1
}

/** Group into 4-character blocks for display: "PL10 2030 4000 ...". */
export function formatIban(input: string): string {
  return normalizeIban(input).replace(/(.{4})/g, '$1 ').trim()
}

/** Build a checksum-valid IBAN from a 16-digit account number. */
function buildPolishIban(accountNumber: string): string {
  const bban = `${NEOBANK_SORT_CODE}${accountNumber}`
  const checkable = `${bban}PL00`
  const numeric = checkable
    .split('')
    .map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join('')
  const checkDigits = String(98 - mod97(numeric)).padStart(2, '0')

  return `PL${checkDigits}${bban}`
}

/**
 * Generate a fresh NeoBank IBAN. `uniqueSuffix` (when supplied) makes the
 * result deterministic — the seeder relies on that for reproducible data.
 */
export function generateIban(uniqueSuffix?: string): string {
  const accountNumber = uniqueSuffix
    ? uniqueSuffix.replace(/\D/g, '').padStart(16, '0').slice(-16)
    : Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')

  return buildPolishIban(accountNumber)
}
