interface PartyAccount {
  iban?: string
  name?: string
  user?: { firstName: string; lastName: string } | null
}

interface TransferLike {
  type: string
  externalName?: string | null
  externalIban?: string | null
  sourceAccount?: PartyAccount | null
  destinationAccount?: PartyAccount | null
}

/**
 * Resolves "who was the other party" for a transfer.
 *
 * Kept in one place because the customer statement, the dashboard row and the
 * admin ledger previously each had their own version with different fallbacks,
 * so the same transfer showed a different counterparty per screen.
 */
export function useCounterparty() {
  function personName(account?: PartyAccount | null): string | null {
    if (!account?.user) return null

    return `${account.user.firstName} ${account.user.lastName}`
  }

  /** Counterparty as seen from one side of the ledger. */
  function forEntry(transfer: TransferLike, direction: 'DEBIT' | 'CREDIT'): string {
    if (transfer.externalName) return transfer.externalName

    const other = direction === 'CREDIT' ? transfer.sourceAccount : transfer.destinationAccount
    const named = personName(other)

    if (named) return named
    if (other?.name) return other.name

    if (transfer.type === 'DEPOSIT') return 'Incoming payment'
    if (transfer.type === 'WITHDRAWAL') return 'Cash withdrawal'
    if (transfer.type === 'INTERNAL') {
      return direction === 'CREDIT' ? 'Transfer from your account' : 'Transfer to your account'
    }

    return 'External account'
  }

  /** Bank-wide view: label one specific side of the transfer. */
  function forSide(
    account: PartyAccount | null | undefined,
    fallbackName?: string | null,
    fallbackIban?: string | null,
  ): string {
    const named = personName(account)

    if (named) return named
    if (fallbackName) return fallbackName
    if (fallbackIban) return `•••• ${fallbackIban.slice(-4)}`

    return '—'
  }

  return { forEntry, forSide }
}
