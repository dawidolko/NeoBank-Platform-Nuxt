import { randomBytes } from 'node:crypto'
import { Prisma, type Currency, type TransferType } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { centsToDecimalString, hasSufficientFunds } from '../utils/money'
import { isValidIban, normalizeIban } from '../utils/iban'
import { recordAudit } from './audit'

export class TransferError extends Error {
  constructor(
    message: string,
    readonly statusCode = 422,
  ) {
    super(message)
    this.name = 'TransferError'
  }
}

/** Ceiling for a single self-service deposit: 1 000 000.00 in minor units. */
export const MAX_DEPOSIT_CENTS = 100_000_000n

/** Ceiling for a single outgoing transfer: 1 000 000.00 in minor units. */
export const MAX_TRANSFER_CENTS = 100_000_000n

export interface TransferInput {
  userId: string
  sourceAccountId: string
  amountCents: bigint
  title: string
  /** Internal transfer: the destination NeoBank IBAN. */
  destinationIban: string
  /** Shown on the statement when the destination is outside NeoBank. */
  externalName?: string
}

/** Human-facing reference, e.g. 'NB-3F8A21C4'. */
function generateReference(): string {
  return `NB-${randomBytes(4).toString('hex').toUpperCase()}`
}

/**
 * Postgres serialization failure / deadlock — the transaction may be retried.
 *
 * The SQLSTATE is not always on `error.code`: Prisma surfaces a failed
 * `$queryRaw` as P2010 and keeps the real `40001` only in the message text, so
 * matching on the code alone silently disables every retry.
 */
function isRetryableConflict(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }

  // Direct SQLSTATEs and Prisma's own transaction-conflict code.
  if (code === '40001' || code === '40P01' || code === 'P2034') return true

  // P2010 = raw query failed; the SQLSTATE is embedded in the message.
  if (code === 'P2010' && /\b40001\b|\b40P01\b/.test(message ?? '')) return true

  return /could not serialize access|deadlock detected/i.test(message ?? '')
}

/**
 * Retry a serializable transaction that lost a write conflict.
 *
 * Under SERIALIZABLE, two transfers racing on the same account can abort with
 * SQLSTATE 40001 even though neither is wrong — the correct response is to
 * replay, not to surface a database error to the customer. Business failures
 * (TransferError) are never retried.
 */
async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  attempts = 8,
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof TransferError || !isRetryableConflict(error))
        throw error

      // Exponential backoff with full jitter. Under a burst on one account the
      // aborts arrive together, so a fixed delay just re-synchronizes the
      // replays into the same collision; spreading them out is what actually
      // drains the queue. Capped so a caller never waits unboundedly.
      if (attempt < attempts) {
        const ceiling = Math.min(15 * 2 ** (attempt - 1), 400)

        await new Promise((resolve) => setTimeout(resolve, Math.random() * ceiling))
      }
    }
  }

  throw new TransferError(
    'The account was busy processing another payment. Please try again.',
    409,
  )
}

/** Internals exposed for unit tests only — not part of the service API. */
export const __testing = { isRetryableConflict }

/**
 * Execute a transfer.
 *
 * Runs in a single serializable transaction: both accounts are locked in a
 * deterministic order (by id) before any balance is read, so two concurrent
 * transfers touching the same pair cannot interleave into a lost update or a
 * deadlock. The debit is re-checked against the *locked* balance, never the
 * value the caller saw.
 */
export async function executeTransfer(input: TransferInput) {
  const { userId, sourceAccountId, amountCents, title } = input

  if (amountCents <= 0n) {
    throw new TransferError('Amount must be greater than zero')
  }

  if (amountCents > MAX_TRANSFER_CENTS) {
    throw new TransferError(
      `Transfers are limited to ${centsToDecimalString(MAX_TRANSFER_CENTS)} per transaction`,
    )
  }

  const destinationIban = normalizeIban(input.destinationIban)

  if (!isValidIban(destinationIban)) {
    throw new TransferError('Recipient IBAN is not valid')
  }

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const source = await tx.account.findFirst({
          where: { id: sourceAccountId, userId },
        })

        if (!source) throw new TransferError('Source account not found', 404)
        if (source.status !== 'ACTIVE') {
          throw new TransferError(
            `Source account is ${source.status.toLowerCase()}`,
          )
        }
        if (source.iban === destinationIban) {
          throw new TransferError('Cannot transfer to the same account')
        }

        const match = await tx.account.findUnique({
          where: { iban: destinationIban },
        })

        // A destination that cannot receive the money is treated as external
        // rather than rejected with a specific reason. Saying "that account is
        // frozen" or "that account is in EUR" would confirm the IBAN belongs to
        // NeoBank and disclose its state, turning transfers into an account
        // enumeration oracle. Only the owner's own accounts get a real message.
        const usable = match !== null && match.status === 'ACTIVE' && match.currency === source.currency

        if (match && !usable && match.userId === userId) {
          throw new TransferError(
            match.status !== 'ACTIVE'
              ? `Your ${match.name} account is ${match.status.toLowerCase()} and cannot receive transfers`
              : `Your ${match.name} account is in ${match.currency}; NeoBank does not convert currency`,
          )
        }

        const destination = usable ? match : null
        const isInternal = destination !== null

        // Lock every touched row in a stable order to avoid deadlocks.
        const lockIds = [source.id, destination?.id]
          .filter((id): id is string => Boolean(id))
          .sort()

        await tx.$queryRaw`SELECT id FROM accounts WHERE id = ANY(${lockIds}::text[]) ORDER BY id FOR UPDATE`

        // Re-read post-lock: this is the balance the decision is actually made on.
        const lockedSource = await tx.account.findUniqueOrThrow({
          where: { id: source.id },
        })

        if (
          !hasSufficientFunds(
            lockedSource.balanceCents,
            lockedSource.overdraftCents,
            amountCents,
          )
        ) {
          throw new TransferError('Insufficient funds')
        }

        const type: TransferType = isInternal ? 'INTERNAL' : 'EXTERNAL'
        const transfer = await tx.transfer.create({
          data: {
            reference: generateReference(),
            type,
            status: 'COMPLETED',
            amountCents,
            currency: source.currency as Currency,
            title: title.trim(),
            sourceAccountId: source.id,
            destinationAccountId: destination?.id ?? null,
            externalIban: isInternal ? null : destinationIban,
            externalName: isInternal
              ? null
              : input.externalName?.trim() || 'External recipient',
          },
        })

        // --- Debit leg ---
        const sourceBalanceAfter = lockedSource.balanceCents - amountCents

        await tx.account.update({
          where: { id: source.id },
          data: { balanceCents: sourceBalanceAfter },
        })
        await tx.entry.create({
          data: {
            accountId: source.id,
            transferId: transfer.id,
            direction: 'DEBIT',
            amountCents: -amountCents,
            balanceAfterCents: sourceBalanceAfter,
          },
        })

        // --- Credit leg (only when the money stays inside NeoBank) ---
        if (destination) {
          const lockedDestination = await tx.account.findUniqueOrThrow({
            where: { id: destination.id },
          })
          const destinationBalanceAfter =
            lockedDestination.balanceCents + amountCents

          await tx.account.update({
            where: { id: destination.id },
            data: { balanceCents: destinationBalanceAfter },
          })
          await tx.entry.create({
            data: {
              accountId: destination.id,
              transferId: transfer.id,
              direction: 'CREDIT',
              amountCents,
              balanceAfterCents: destinationBalanceAfter,
            },
          })
        }

        await recordAudit(tx, {
          userId,
          action: 'transfer.executed',
          entityType: 'Transfer',
          entityId: transfer.id,
          metadata: {
            reference: transfer.reference,
            amountCents: amountCents.toString(),
            currency: source.currency,
            type,
          },
        })

        return transfer
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      },
    ),
  )
}

/**
 * Credit an account from outside the system (salary, top-up).
 * Same locking discipline as `executeTransfer`, single leg.
 */
export async function executeDeposit(params: {
  userId: string
  accountId: string
  amountCents: bigint
  title: string
}) {
  if (params.amountCents <= 0n) {
    throw new TransferError('Amount must be greater than zero')
  }

  // Deposits are self-service in this demo, so they need an explicit ceiling —
  // otherwise any customer could mint an unbounded balance.
  if (params.amountCents > MAX_DEPOSIT_CENTS) {
    throw new TransferError(
      `Deposits are limited to ${centsToDecimalString(MAX_DEPOSIT_CENTS)} per transaction`,
    )
  }

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const account = await tx.account.findFirst({
          where: { id: params.accountId, userId: params.userId },
        })

        if (!account) throw new TransferError('Account not found', 404)
        if (account.status !== 'ACTIVE')
          throw new TransferError('Account is not active')

        await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${account.id} FOR UPDATE`

        const locked = await tx.account.findUniqueOrThrow({
          where: { id: account.id },
        })
        const balanceAfter = locked.balanceCents + params.amountCents

        const transfer = await tx.transfer.create({
          data: {
            reference: generateReference(),
            type: 'DEPOSIT',
            status: 'COMPLETED',
            amountCents: params.amountCents,
            currency: account.currency,
            title: params.title.trim(),
            destinationAccountId: account.id,
          },
        })

        await tx.account.update({
          where: { id: account.id },
          data: { balanceCents: balanceAfter },
        })
        await tx.entry.create({
          data: {
            accountId: account.id,
            transferId: transfer.id,
            direction: 'CREDIT',
            amountCents: params.amountCents,
            balanceAfterCents: balanceAfter,
          },
        })

        await recordAudit(tx, {
          userId: params.userId,
          action: 'deposit.executed',
          entityType: 'Transfer',
          entityId: transfer.id,
          metadata: {
            reference: transfer.reference,
            amountCents: params.amountCents.toString(),
          },
        })

        return transfer
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      },
    ),
  )
}
