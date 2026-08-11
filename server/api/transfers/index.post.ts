import { requireUser } from '../../utils/auth'
import { parseOrThrow, transferSchema } from '../../utils/validation'
import { parseAmountToCents } from '../../utils/money'
import { serializeBigInt } from '../../utils/serialize'
import { executeTransfer, TransferError } from '../../services/transfers'
import { enforceRateLimit } from '../../utils/rateLimit'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  enforceRateLimit(event, { key: 'transfer', limit: 20, windowMs: 60_000, identifier: user.id })

  const input = parseOrThrow(transferSchema, await readBody(event))

  // Amount is parsed in the source account's currency, so scale is correct.
  const account = await prisma.account.findFirst({
    where: { id: input.sourceAccountId, userId: user.id },
    select: { currency: true },
  })

  if (!account) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Account not found',
      data: { errors: { sourceAccountId: 'Select a valid account' } },
    })
  }

  let amountCents: bigint

  try {
    amountCents = parseAmountToCents(input.amount, account.currency)
  } catch (error) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { errors: { amount: (error as Error).message } },
    })
  }

  try {
    const transfer = await executeTransfer({
      userId: user.id,
      sourceAccountId: input.sourceAccountId,
      destinationIban: input.destinationIban,
      amountCents,
      title: input.title,
      externalName: input.externalName,
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
