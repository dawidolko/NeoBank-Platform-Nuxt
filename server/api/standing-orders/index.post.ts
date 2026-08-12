import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { parseOrThrow, standingOrderSchema } from '../../utils/validation'
import { parseAmountToCents } from '../../utils/money'
import { serializeBigInt } from '../../utils/serialize'
import { recordAudit } from '../../services/audit'

const MAX_ORDERS_PER_USER = 20

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const input = parseOrThrow(standingOrderSchema, await readBody(event))

  const account = await prisma.account.findFirst({
    where: { id: input.sourceAccountId, userId: user.id, status: 'ACTIVE' },
  })

  if (!account) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Account not found',
      data: { errors: { sourceAccountId: 'Select an active account' } },
    })
  }

  const existing = await prisma.standingOrder.count({
    where: { userId: user.id, status: { not: 'CANCELLED' } },
  })

  if (existing >= MAX_ORDERS_PER_USER) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Limit reached',
      data: { errors: { form: `You can hold at most ${MAX_ORDERS_PER_USER} standing orders.` } },
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

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.standingOrder.create({
      data: {
        userId: user.id,
        sourceAccountId: account.id,
        destinationIban: input.destinationIban,
        recipientName: input.recipientName,
        title: input.title,
        amountCents,
        interval: input.interval,
        nextRunAt: new Date(`${input.startsOn}T09:00:00.000Z`),
      },
    })

    await recordAudit(tx, {
      userId: user.id,
      action: 'standing_order.created',
      entityType: 'StandingOrder',
      entityId: created.id,
      metadata: { amountCents: amountCents.toString(), interval: created.interval },
    })

    return created
  })

  setResponseStatus(event, 201)

  return serializeBigInt({ order })
})
