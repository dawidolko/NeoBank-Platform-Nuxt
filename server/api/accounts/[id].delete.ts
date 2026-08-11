import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { recordAudit } from '../../services/audit'

/**
 * Close an account. The row is retained (status CLOSED) rather than deleted —
 * its ledger entries are part of the bank's history and must stay auditable.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')

  const account = await prisma.account.findFirst({ where: { id, userId: user.id } })

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  if (account.status === 'CLOSED') {
    throw createError({
      statusCode: 422,
      statusMessage: 'Account is already closed',
      data: { errors: { form: 'This account is already closed.' } },
    })
  }

  if (account.balanceCents !== 0n) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Account balance must be zero',
      data: {
        errors: {
          form: 'Move the remaining balance out of this account before closing it.',
        },
      },
    })
  }

  const remaining = await prisma.account.count({
    where: { userId: user.id, status: 'ACTIVE', NOT: { id: account.id } },
  })

  if (remaining === 0) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Cannot close your only account',
      data: { errors: { form: 'You must keep at least one open account.' } },
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id: account.id }, data: { status: 'CLOSED' } })
    await tx.card.updateMany({ where: { accountId: account.id }, data: { status: 'BLOCKED' } })

    await recordAudit(tx, {
      userId: user.id,
      action: 'account.closed',
      entityType: 'Account',
      entityId: account.id,
      metadata: { iban: account.iban },
    })
  })

  return { success: true }
})
