import { randomBytes } from 'node:crypto'
import { Prisma, type Currency, type TransferType } from '@prisma/client'
import { prisma } from '../utils/prisma'
import { hasSufficientFunds } from '../utils/money'
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

/** Human-facing reference, e.g. "NB-3F8A21C4". */
function generateReference(): string {
  return `NB-${randomBytes(4).toString('hex').toUpperCase()}`
}

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

  const destinationIban = normalizeIban(input.destinationIban)

  if (!isValidIban(destinationIban)) {
    throw new TransferError('Recipient IBAN is not valid')
  }

  return prisma.$transaction(
    async (tx) => {
      const source = await tx.account.findFirst({
        where: { id: sourceAccountId, userId },
      })

      if (!source) throw new TransferError('Source account not found', 404)
      if (source.status !== 'ACTIVE') {
        throw new TransferError(`Source account is ${source.status.toLowerCase()}`)
      }
      if (source.iban === destinationIban) {
        throw new TransferError('Cannot transfer to the same account')
      }

      const destination = await tx.account.findUnique({ where: { iban: destinationIban } })
      const isInternal = destination !== null

      if (destination && destination.status !== 'ACTIVE') {
        throw new TransferError('Recipient account cannot accept transfers')
      }
      if (destination && destination.currency !== source.currency) {
        throw new TransferError(
          `Currency mismatch: cannot send ${source.currency} to a ${destination.currency} account`,
        )
      }

      // Lock every touched row in a stable order to avoid deadlocks.
      const lockIds = [source.id, destination?.id].filter((id): id is string => Boolean(id)).sort()

      await tx.$queryRaw`SELECT id FROM accounts WHERE id = ANY(${lockIds}::text[]) ORDER BY id FOR UPDATE`

      // Re-read post-lock: this is the balance the decision is actually made on.
      const lockedSource = await tx.account.findUniqueOrThrow({ where: { id: source.id } })

      if (!hasSufficientFunds(lockedSource.balanceCents, lockedSource.overdraftCents, amountCents)) {
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
          externalName: isInternal ? null : (input.externalName?.trim() || 'External recipient'),
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
        const destinationBalanceAfter = lockedDestination.balanceCents + amountCents

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
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
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

  return prisma.$transaction(
    async (tx) => {
      const account = await tx.account.findFirst({
        where: { id: params.accountId, userId: params.userId },
      })

      if (!account) throw new TransferError('Account not found', 404)
      if (account.status !== 'ACTIVE') throw new TransferError('Account is not active')

      await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${account.id} FOR UPDATE`

      const locked = await tx.account.findUniqueOrThrow({ where: { id: account.id } })
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
        metadata: { reference: transfer.reference, amountCents: params.amountCents.toString() },
      })

      return transfer
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
  )
}
