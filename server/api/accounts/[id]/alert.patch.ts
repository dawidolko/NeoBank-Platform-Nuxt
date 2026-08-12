import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'
import { lowBalanceSchema, parseOrThrow, requireUuidParam } from '../../../utils/validation'
import { parseAmountToCents } from '../../../utils/money'
import { serializeBigInt } from '../../../utils/serialize'

/** Set or clear the low-balance alert threshold for one account. */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Account')
  const input = parseOrThrow(lowBalanceSchema, await readBody(event))

  const existing = await prisma.account.findFirst({ where: { id, userId: user.id } })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  let threshold: bigint | null = null

  if (input.amount !== null) {
    try {
      threshold = parseAmountToCents(input.amount, existing.currency)
    } catch (error) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Validation failed',
        data: { errors: { amount: (error as Error).message } },
      })
    }
  }

  const account = await prisma.account.update({
    where: { id: existing.id },
    data: { lowBalanceCents: threshold },
  })

  return serializeBigInt({ account })
})
