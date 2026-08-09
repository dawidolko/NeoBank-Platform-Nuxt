import { requireUser } from '../../utils/auth'
import { depositSchema, parseOrThrow } from '../../utils/validation'
import { parseAmountToCents } from '../../utils/money'
import { serializeBigInt } from '../../utils/serialize'
import { executeDeposit, TransferError } from '../../services/transfers'
import { prisma } from '../../utils/prisma'

/**
 * Simulated incoming funds. In a real deployment this would be driven by a
 * payment-rail webhook rather than by the account holder.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const input = parseOrThrow(depositSchema, await readBody(event))

  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId: user.id },
    select: { currency: true },
  })

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  try {
    const transfer = await executeDeposit({
      userId: user.id,
      accountId: input.accountId,
      amountCents: parseAmountToCents(input.amount, account.currency),
      title: input.title,
    })

    setResponseStatus(event, 201)

    return serializeBigInt({ transfer })
  } catch (error) {
    if (error instanceof TransferError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
        data: { errors: { form: error.message } },
      })
    }

    throw error
  }
})
