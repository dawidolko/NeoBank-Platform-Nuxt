/**
 * Presentation helpers.
 *
 * The API sends money as strings of minor units (BigInt cannot cross JSON),
 * so every formatter takes `string | number | bigint` and converts once here.
 */
export function useFormat() {
  const MINOR_UNITS = 2

  function toMajorUnits(cents: string | number | bigint): number {
    return Number(BigInt(cents ?? 0)) / 10 ** MINOR_UNITS
  }

  function money(cents: string | number | bigint, currency = 'PLN'): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: MINOR_UNITS,
    }).format(toMajorUnits(cents))
  }

  /** Signed amount with an explicit +/- prefix, for statement rows. */
  function signedMoney(cents: string | number | bigint, currency = 'PLN'): string {
    const value = BigInt(cents ?? 0)
    const formatted = money(value < 0n ? -value : value, currency)

    return `${value < 0n ? '−' : '+'}${formatted}`
  }

  function date(value: string | Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  }

  function dateTime(value: string | Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  }

  /** "3 days ago" style, falling back to an absolute date past a week. */
  function relative(value: string | Date): string {
    const then = new Date(value).getTime()
    const diffMs = Date.now() - then
    const diffDays = Math.floor(diffMs / 86_400_000)

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return date(value)
  }

  /**
   * Normalizes before grouping, so a value typed with stray spaces or in
   * lowercase renders the same as one straight from the database.
   */
  function iban(value: string | null | undefined): string {
    if (!value) return '—'

    return value.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()
  }

  /** Mask all but the last four characters: "•••• 2874". */
  function maskIban(value: string | null | undefined): string {
    if (!value) return '—'

    return `•••• ${value.slice(-4)}`
  }

  function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }

  return { money, signedMoney, date, dateTime, relative, iban, maskIban, titleCase, toMajorUnits }
}
